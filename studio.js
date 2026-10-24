// ==================================================================
// studio.js — le sezioni della società: Panoramica, una pagina per ogni app del portafoglio e le Pagine satellite.
// Si appoggia ad app.js (el, sql, S, CAN, rc, head, toast, num, ...), caricato prima. Tutto resta dentro questa funzione,
// così niente si scontra con i nomi di app.js. Le sezioni si registrano in EXT (vedi app.js).
// ==================================================================
(() => {
  'use strict';

  // ---------------------------------------------------------------- costanti
  // colori delle app: palette dei grafici controllata anche per chi non distingue bene i colori (sfondo scuro del pannello)
  const APP_COLORS = [['#3987E5', 'Blu'], ['#D95926', 'Arancio'], ['#199E70', 'Acqua'], ['#C98500', 'Giallo'], ['#D55181', 'Magenta'], ['#008300', 'Verde'], ['#9085E9', 'Viola'], ['#E66767', 'Rosso']];
  const NO_APP = { id: '_none', name: 'Senza app', color: '#77746C' };
  const PLAT = { tiktok: ['TikTok', '#FF3B6B'], instagram: ['Instagram', '#E1306C'], youtube: ['YouTube', '#FF4B4B'], x: ['X', '#C9D1DE'], facebook: ['Facebook', '#4F86F7'],
    threads: ['Threads', '#B6BFCE'], linkedin: ['LinkedIn', '#3B8FFF'], pinterest: ['Pinterest', '#E60023'], twitch: ['Twitch', '#A970FF'] };
  const STATUS = { attivo: ['Attivo', 'done'], pausa: ['In pausa', 'no'], limitato: ['Limitato', 'new'], bloccato: ['Bloccato', 'bad'], chiuso: ['Chiuso', 'dim'] };
  // numeri delle app: [chiave, etichetta, spiegazione, soldi?]
  const APP_M = [
    ['mrr', 'MRR', 'Entrate ricorrenti al mese dagli abbonamenti attivi', true],
    ['subs', 'Abbonati', 'Abbonamenti attivi', false],
    ['trials', 'In prova', 'Prove gratuite attive', false],
    ['users', 'Utenti', 'Utenti totali', false],
    ['active', 'Attivi', 'Utenti attivi negli ultimi 30 giorni', false],
    ['new_users', 'Nuovi', 'Nuovi utenti negli ultimi 30 giorni', false],
    ['revenue', 'Incassi', 'Incassi degli ultimi 30 giorni', true],
  ];
  const SAT_M = [['v', 'Views'], ['f', 'Follower'], ['p', 'Post'], ['i', 'Interazioni']];
  const WK_M = [['f', 'Follower'], ['v', 'Views'], ['p', 'Post'], ['i', 'Interazioni']];   // ordine dei campi quando si scrivono i numeri
  const PUSH_URL = SB_URL + '/rest/v1/rpc/metrics_push';
  const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  const ic = (svg) => { const s = document.createElement('span'); s.className = 'sat-lock'; s.innerHTML = svg; return s; };   // solo SVG fisse scritte qui sopra

  S.appd = S.appd || {};
  Object.assign(SUB, {
    Panoramica: 'Le app di ' + COMPANY.name + ', i loro numeri e le pagine che le fanno crescere.',
    'Pagine satellite': 'Le pagine che spingono le app: chi le gestisce, gli account e i numeri di ogni settimana. Le password sono cifrate e le vede solo chi ha il permesso.',
  });

  // ---------------------------------------------------------------- utilità
  const appsAll = () => S.apps || (S.st && S.st.apps) || (S.sat && S.sat.apps) || [];
  const appOf = (id) => appsAll().find((a) => a.id === id) || (S.sat && (S.sat.apps || []).find((a) => a.id === id)) || null;
  const colorOf = (id) => { const a = id && id !== NO_APP.id ? appOf(id) : null; return a ? a.color : NO_APP.color; };
  const nameOf = (id) => { const a = id && id !== NO_APP.id ? appOf(id) : null; return a ? a.name : NO_APP.name; };
  function appMark(a, size) {
    if (a && a.id === 'noonframe') return el('span', { class: 'app-mk logo' + (size ? ' ' + size : ''), 'aria-hidden': 'true' }, el('img', { src: 'logo.png', alt: '' }));
    return el('span', { class: 'app-mk' + (size ? ' ' + size : ''), style: '--ac:' + ((a && a.color) || NO_APP.color), 'aria-hidden': 'true' }, ((a && a.name) || '?').trim().charAt(0).toUpperCase());
  }
  const eurS = (v) => { v = +v || 0; const neg = v < 0; v = Math.abs(v); let i = Math.floor(v), d = Math.round((v - i) * 100); if (d === 100) { i++; d = 0; } return (neg ? '−' : '') + num(i) + (d ? ',' + String(d).padStart(2, '0') : '') + ' €'; };
  const money = (v) => (v == null ? '—' : eurS(v));
  const fmtM = (k, v) => (v == null || v === '' ? '—' : (APP_M.find((m) => m[0] === k) || [])[3] ? eurS(v) : num(v));
  const pctDelta = (now, prev) => { if (now == null || prev == null || now === '' || prev === '') return null; now = +now; prev = +prev; if (!isFinite(now) || !isFinite(prev) || prev < 10) return null; return Math.round((now - prev) / prev * 100); };
  const deltaEl = (p, suffix) => (p == null ? null : el('span', { class: 'st-delta ' + (p > 0 ? 'pos' : p < 0 ? 'neg' : '') }, (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p) + '% ' + (suffix || '')));
  const longDay = (d) => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  function wkLabel(w) {
    const a = new Date(w + 'T12:00:00'), b = new Date(addDays(w, 6) + 'T12:00:00');
    const sameM = a.getMonth() === b.getMonth();
    return 'dal ' + a.getDate() + (sameM ? '' : ' ' + a.toLocaleDateString('it-IT', { month: 'long' })) + ' al ' + b.getDate() + ' ' + b.toLocaleDateString('it-IT', { month: 'long' });
  }
  const wkShort = (w) => new Date(w + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  const memberName = (email, members) => { const m = (members || []).find((x) => x.email === email); return (m && m.name) || (email ? email.split('@')[0] : ''); };
  function copy(txt, msg) {
    const done = () => toast(msg || 'Copiato');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => toast('Non riesco a copiare: selezionalo e copialo a mano'));
    else toast('Non riesco a copiare: selezionalo e copialo a mano');
  }
  // "12.500", "12,5k", "1,2M", "180000", "262,50" -> numero; vuoto -> null
  function parseN(v, dec) {
    let s = String(v == null ? '' : v).trim().toLowerCase().replace(/[\s€$]/g, '');
    if (!s) return { ok: true, v: null };
    let mult = 1;
    const m = s.match(/^(.*?)(k|mila|m|mln)$/);
    if (m) { s = m[1]; mult = m[2] === 'k' || m[2] === 'mila' ? 1e3 : 1e6; }
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false };
    let n = parseFloat(s) * mult;
    n = dec ? Math.round(n * 100) / 100 : Math.round(n);
    return { ok: true, v: n };
  }
  const inVal = (v, dec) => (v == null ? '' : dec ? String(v).replace('.', ',') : String(Math.round(+v)));

  function stModal(title, kids, foot, cls) {
    const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } },
      el('div', { class: 'modal sat-modal ' + (cls || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, el('h2', null, title), ...kids,
        el('div', { class: 'row', style: 'justify-content:flex-end;gap:8px;margin-top:4px' }, ...foot(close))));
    document.body.append(bg);
    return close;
  }
  const fld = (label, input, hint) => el('label', { class: 'fld' }, el('span', null, label), input, hint ? el('small', { class: 'muted' }, hint) : null);
  const inp = (attrs) => el('input', Object.assign({ class: 'search' }, attrs));
  const btnArm = (label, armed, onGo) => {   // pulsante rosso che chiede conferma al secondo clic
    let on = false;
    return el('button', { class: 'btn bad', type: 'button', style: 'margin-right:auto', onclick: async (e) => { const bt = e.currentTarget;
      if (!on) { on = true; bt.textContent = armed; return; }
      bt.disabled = true;
      try { await onGo(); } catch (er) { toast(explain(er)); bt.disabled = false; }
    } }, label);
  };

  // ---------------------------------------------------------------- grafici (SVG): griglia sottile, linee da 2px, tooltip al passaggio
  function niceStep(x) { if (x <= 0) return 1; const e = Math.pow(10, Math.floor(Math.log10(x))); const f = x / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
  function yScale(max, isInt) {
    let step = niceStep(Math.max(max, isInt ? 4 : 1) / 4); if (isInt) step = Math.max(1, Math.ceil(step));
    const top = Math.max(step, Math.ceil(max / step) * step);
    const ticks = []; for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
    return { top, ticks };
  }
  const axFmt = (v, isMoney) => (isMoney ? (v >= 1000 ? short(v) + ' €' : Math.round(v) + ' €') : short(v));
  function tipBox(wrap) { const t = el('div', { class: 'st-tip', hidden: true }); wrap.append(t); return t; }
  function responsive(draw) {
    const host = el('div', { class: 'st-chart' });
    let lastW = 0, tid = null;
    const paint = () => {
      if (!host.isConnected) { ro.disconnect(); return; }
      const w = Math.round(host.clientWidth); if (!w || Math.abs(w - lastW) < 2) return;
      lastW = w; host.replaceChildren(); draw(Math.max(260, w), host);
    };
    const ro = new ResizeObserver(() => { clearTimeout(tid); tid = setTimeout(paint, lastW ? 60 : 0); });
    ro.observe(host);
    requestAnimationFrame(paint);
    return host;
  }
  // etichette dell'asse x: dall'ultima indietro, solo se c'è spazio (niente sovrapposizioni)
  function xLabels(xs, minGap) {
    const keep = []; let lastX = Infinity;
    for (let i = xs.length - 1; i >= 0; i--) { if (lastX - xs[i] >= minGap) { keep.push(i); lastX = xs[i]; } }
    return keep.reverse();
  }
  function placeTip(tip, wrap, px, py) {
    tip.hidden = false;
    const W = wrap.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = px + 14; if (x + tw > W) x = px - tw - 14; if (x < 0) x = 0;
    tip.style.left = x + 'px'; tip.style.top = Math.max(0, py - th - 8) + 'px';
  }

  // linea nel tempo: punti irregolari (foto dei numeri), area leggera, punto finale, obiettivo facoltativo
  function lineChart(pts, opt) { return responsive((W, wrap) => drawLine(W, wrap, pts, opt)); }
  function drawLine(W, wrap, pts, opt) {
    const H = 230, P = { l: 56, r: 18, t: 14, b: 28 };
    const color = opt.color || 'var(--c1)';
    const vals = pts.map((p) => p.v);
    let max = Math.max(0, ...vals);
    const goal = opt.goal && opt.goal.v > 0 && opt.goal.v <= Math.max(max * 1.6, 1) ? opt.goal : null;
    if (goal) max = Math.max(max, goal.v);
    const { top, ticks } = yScale(max || 1, !opt.money);
    const t0 = new Date(pts[0].d + 'T12:00:00').getTime(), t1 = new Date(pts[pts.length - 1].d + 'T12:00:00').getTime();
    const x = (d) => (t1 === t0 ? (P.l + W - P.r) / 2 : P.l + (new Date(d + 'T12:00:00').getTime() - t0) / (t1 - t0) * (W - P.l - P.r));
    const y = (v) => H - P.b - v / top * (H - P.t - P.b);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opt.label || '' });
    ticks.forEach((v) => {
      svg.append(svgEl('line', { class: v === 0 ? 'base' : 'gd', x1: P.l, x2: W - P.r, y1: y(v), y2: y(v) }));
      const t = svgEl('text', { class: 'ax', x: P.l - 8, y: y(v) + 3.5, 'text-anchor': 'end' }); t.textContent = axFmt(v, opt.money); svg.append(t);
    });
    // etichette dei giorni: senza accavallarsi (si parte dall'ultima)
    const lx = xLabels(pts.map((p) => x(p.d)), 64);
    lx.forEach((i, k) => {
      const anchor = pts.length === 1 ? 'middle' : i === pts.length - 1 ? 'end' : (k === 0 && x(pts[i].d) - P.l < 30) ? 'start' : 'middle';
      const t = svgEl('text', { class: 'ax', x: x(pts[i].d), y: H - 8, 'text-anchor': anchor });
      t.textContent = shortDay(pts[i].d + 'T12:00:00'); svg.append(t);
    });
    if (goal) {
      svg.append(svgEl('line', { class: 'st-gl', x1: P.l, x2: W - P.r, y1: y(goal.v), y2: y(goal.v) }));
      const t = svgEl('text', { class: 'st-glt', x: W - P.r, y: y(goal.v) - 6, 'text-anchor': 'end' }); t.textContent = goal.label; svg.append(t);
    }
    if (pts.length > 1) {
      const line = pts.map((p) => x(p.d).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ');
      svg.append(svgEl('polygon', { points: x(pts[0].d).toFixed(1) + ',' + y(0) + ' ' + line + ' ' + x(pts[pts.length - 1].d).toFixed(1) + ',' + y(0), fill: color, 'fill-opacity': '0.10', stroke: 'none' }));
      svg.append(svgEl('polyline', { points: line, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    }
    if (pts.length <= 14) pts.slice(0, -1).forEach((p) => svg.append(svgEl('circle', { cx: x(p.d), cy: y(p.v), r: 4, fill: color, stroke: 'var(--panel)', 'stroke-width': 2 })));
    const last = pts[pts.length - 1];
    svg.append(svgEl('circle', { cx: x(last.d), cy: y(last.v), r: 4.5, fill: color, stroke: 'var(--panel)', 'stroke-width': 2 }));
    // passaggio del mouse: linea verticale e valore del punto più vicino
    const cross = svgEl('line', { class: 'cross', y1: P.t, y2: H - P.b, visibility: 'hidden' });
    const dot = svgEl('circle', { r: 5, fill: color, stroke: 'var(--panel)', 'stroke-width': 2, visibility: 'hidden', 'pointer-events': 'none' });
    const hit = svgEl('rect', { class: 'hit', x: P.l, y: P.t, width: W - P.l - P.r, height: H - P.t - P.b });
    svg.append(cross, dot, hit);
    wrap.append(svg);
    const tip = tipBox(wrap);
    const show = (ev) => {
      const r = svg.getBoundingClientRect(); const sx = (ev.clientX - r.left) / r.width * W;
      let bi = 0, bd = Infinity; pts.forEach((p, i) => { const dd = Math.abs(x(p.d) - sx); if (dd < bd) { bd = dd; bi = i; } });
      const p = pts[bi]; const cx = x(p.d), cy = y(p.v);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('visibility', 'visible');
      rc(tip, el('b', null, longDay(p.d)), el('div', { class: 'r', style: '--sc:' + color }, el('i'), el('span', null, opt.name || ''), el('em', null, opt.money ? eurS(p.v) : num(p.v))),
        p.note ? el('div', { class: 'muted', style: 'font-size:11px;margin-top:2px' }, p.note) : null);
      placeTip(tip, wrap, cx / W * r.width, cy / H * r.height);
    };
    const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); };
    hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show); hit.addEventListener('pointerleave', hide);
  }

  // colonne impilate per settimana (una serie per app), 2px di spazio tra i pezzi, angoli tondi solo in cima
  function stackChart(weeks, series, opt) {
    const leg = series.length > 1 ? el('div', { class: 'st-leg' }, ...series.map((sr) => el('span', { style: '--sc:' + sr.color }, el('i'), sr.name))) : null;
    return el('div', { style: 'display:grid;gap:8px' }, leg, responsive((W, wrap) => drawStack(W, wrap, weeks, series, opt)));
  }
  function drawStack(W, wrap, weeks, series, opt) {
    const H = 210, P = { l: 52, r: 10, t: 12, b: 26 };
    const totals = weeks.map((w) => series.reduce((s, sr) => s + (+sr.values[w] || 0), 0));
    const { top, ticks } = yScale(Math.max(1, ...totals), true);
    const band = (W - P.l - P.r) / weeks.length, bw = Math.min(24, band * 0.62);
    const x = (i) => P.l + band * (i + 0.5), y = (v) => H - P.b - v / top * (H - P.t - P.b);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opt.label || '' });
    ticks.forEach((v) => {
      svg.append(svgEl('line', { class: v === 0 ? 'base' : 'gd', x1: P.l, x2: W - P.r, y1: y(v), y2: y(v) }));
      const t = svgEl('text', { class: 'ax', x: P.l - 8, y: y(v) + 3.5, 'text-anchor': 'end' }); t.textContent = short(v); svg.append(t);
    });
    const lab = new Set(xLabels(weeks.map((w, i) => x(i)), 52));
    weeks.forEach((w, i) => {
      let acc = 0;
      const segs = series.map((sr) => ({ sr, v: +sr.values[w] || 0 })).filter((s) => s.v > 0);
      segs.forEach((s, k) => {
        const y0 = y(acc), y1 = y(acc + s.v); acc += s.v;
        const isTop = k === segs.length - 1;
        const gap = k > 0 ? 2 : 0;                        // spazio tra un pezzo e l'altro
        const hgt = Math.max(1, y0 - y1 - gap), x0 = x(i) - bw / 2, yt = y1;
        if (isTop && hgt > 4) {
          const r = Math.min(4, bw / 2, hgt);
          svg.append(svgEl('path', { fill: s.sr.color, d: `M${x0},${yt + hgt} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x0 + bw - r} Q${x0 + bw},${yt} ${x0 + bw},${yt + r} V${yt + hgt} Z` }));
        } else svg.append(svgEl('rect', { x: x0, y: yt, width: bw, height: hgt, fill: s.sr.color }));
      });
      if (lab.has(i)) { const t = svgEl('text', { class: 'ax', x: x(i), y: H - 8, 'text-anchor': i === weeks.length - 1 && band < 50 ? 'end' : 'middle' }); t.textContent = wkShort(w); svg.append(t); }
    });
    const hits = weeks.map((w, i) => { const h = svgEl('rect', { class: 'hit', x: P.l + band * i, y: P.t, width: band, height: H - P.t - P.b }); svg.append(h); return h; });
    wrap.append(svg);
    const tip = tipBox(wrap);
    hits.forEach((h, i) => {
      const show = () => {
        const r = svg.getBoundingClientRect(); const w = weeks[i];
        const rows = series.filter((sr) => sr.values[w] != null).map((sr) => el('div', { class: 'r', style: '--sc:' + sr.color }, el('i'), el('span', null, sr.name), el('em', null, num(sr.values[w]))));
        rc(tip, el('b', null, 'Settimana ' + wkLabel(w)), ...(rows.length ? rows : [el('div', { class: 'muted' }, 'Nessun numero')]),
          series.length > 1 && rows.length > 1 ? el('div', { class: 'r tot' }, el('span', null, 'Totale'), el('em', null, num(totals[i]))) : null);
        placeTip(tip, wrap, x(i) / W * r.width, y(totals[i]) / H * r.height);
      };
      h.addEventListener('pointermove', show); h.addEventListener('pointerdown', show); h.addEventListener('pointerleave', () => { tip.hidden = true; });
    });
  }

  // andamento piccolo (righe e schede): linea neutra, ultimo punto nel colore
  function spark(vals, color, w = 110, h = 30) {
    const v = vals.map((x) => (x == null ? null : +x));
    const known = v.filter((x) => x != null);
    if (known.length < 2) return el('span', { class: 'muted', style: 'font-size:11.5px' }, known.length ? '' : '—');
    const max = Math.max(...known), min = Math.min(0, ...known), span = max - min || 1;
    const X = (i) => 2 + i * (w - 6) / (v.length - 1), Y = (x) => h - 3 - (x - min) / span * (h - 7);
    const svg = svgEl('svg', { class: 'st-spark', width: w, height: h, viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });
    const pts = v.map((x, i) => (x == null ? null : X(i).toFixed(1) + ',' + Y(x).toFixed(1))).filter(Boolean).join(' ');
    svg.append(svgEl('polyline', { points: pts, fill: 'none', stroke: 'rgba(246,244,239,.38)', 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    let li = v.length - 1; while (li > 0 && v[li] == null) li--;
    svg.append(svgEl('circle', { cx: X(li), cy: Y(v[li]), r: 3, fill: color || 'var(--accent)' }));
    return svg;
  }

  // ---------------------------------------------------------------- menu: marchio, app del portafoglio, gruppi richiudibili
  function paintBrand() {
    const n = $('#brandName'), m = $('#brandMk');
    if (n) n.textContent = COMPANY.name;
    if (m) m.textContent = COMPANY.name.charAt(0).toUpperCase();
    if (document.fonts && document.fonts.load) document.fonts.load('900 40px "Archivo Variable"').then(favicon, favicon); else favicon();
  }
  function favicon() {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#3D82FF'; g.beginPath();
      if (g.roundRect) g.roundRect(0, 0, 64, 64, 16); else g.rect(0, 0, 64, 64);
      g.fill(); g.fillStyle = '#FFFFFF'; g.font = '900 40px "Archivo Variable", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(COMPANY.name.charAt(0).toUpperCase(), 32, 35);
      let l = document.querySelector('link[rel="icon"]'); if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.append(l); }
      l.href = c.toDataURL('image/png');
    } catch (e) { /* resta l'icona di prima */ }
  }
  const FOLD_KEY = 'nf.admin.fold';
  let FOLD = new Set();
  try { FOLD = new Set(JSON.parse(localStorage.getItem(FOLD_KEY) || '[]')); } catch (e) { /* */ }
  function groupItems(hd) { const out = []; let x = hd.nextElementSibling; while (x && !x.classList.contains('nav-h') && !x.classList.contains('nav-foot')) { if (x.classList.contains('nav-i')) out.push(x); x = x.nextElementSibling; } return out; }
  function applyFold() {
    document.querySelectorAll('.nav-h[data-g]').forEach((hd) => {
      const closed = FOLD.has(hd.dataset.g);
      hd.classList.toggle('closed', closed); hd.setAttribute('aria-expanded', String(!closed));
      groupItems(hd).forEach((b) => b.classList.toggle('folded', closed));
    });
  }
  function saveFold() { try { localStorage.setItem(FOLD_KEY, JSON.stringify([...FOLD])); } catch (e) { /* */ } }
  function setupFold() {
    document.querySelectorAll('.nav-h[data-g]').forEach((hd) => {
      if (hd.dataset.fold) return; hd.dataset.fold = '1';
      hd.setAttribute('role', 'button'); hd.tabIndex = 0; hd.title = 'Apri o chiudi il gruppo';
      const toggle = () => { const g = hd.dataset.g; if (FOLD.has(g)) FOLD.delete(g); else FOLD.add(g); saveFold(); applyFold(); };
      hd.addEventListener('click', toggle);
      hd.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
    applyFold();
  }
  function markCurrent() { document.querySelectorAll('.nav-i').forEach((b) => b.setAttribute('aria-current', b.dataset.view === S.view ? 'page' : 'false')); }
  function openGroupOf(view) {   // se apri una sezione da un link, il suo gruppo si riapre
    const b = [...document.querySelectorAll('.nav-i')].find((x) => x.dataset.view === view); if (!b) return;
    let hd = b.previousElementSibling; while (hd && !hd.classList.contains('nav-h')) hd = hd.previousElementSibling;
    if (hd && FOLD.has(hd.dataset.g)) { FOLD.delete(hd.dataset.g); saveFold(); applyFold(); }
  }
  async function loadApps(force) { if (force || !S.apps) S.apps = await sql('apps'); return S.apps; }
  async function navApps(force) {
    try { await loadApps(force); } catch (e) { return; }
    const hd = document.querySelector('.nav-h[data-g="app"]'); if (!hd) return;
    document.querySelectorAll('.nav-app').forEach((b) => b.remove());
    let after = hd;
    for (const a of S.apps || []) {
      const b = el('button', { class: 'nav-i nav-app', type: 'button', 'data-view': 'app:' + a.id, 'data-perm': 'launch', onclick: () => go('app:' + a.id) }, appMark(a, 'sm'), a.name);
      after.after(b); after = b;
    }
    paintMe(); applyFold(); markCurrent();
  }
  paintBrand();

  // ---------------------------------------------------------------- Panoramica
  function renderHome(main) {
    const body = el('div', { class: 'body' });
    const add = CAN('apps') && S.st && (S.st.apps || []).length >= 6 ? el('button', { class: 'btn', type: 'button', onclick: () => appModal(null) }, '+ App') : null;
    rc(main, head('Panoramica', add), body);
    if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
    const D = S.st; if (!D) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
    const apps = D.apps || [];
    const withK = apps.filter((a) => a.k);
    const sum = (k) => withK.reduce((s, a) => s + (+a.k[k] || 0), 0);
    const per = (k, f) => withK.filter((a) => a.k[k] != null).map((a) => a.name + ' ' + f(a.k[k])).join(', ');
    const sat = D.sat || {};
    const vd = pctDelta(sat.views, sat.views_prev);
    const kpi = (v, label, sub, go_) => el(go_ ? 'button' : 'div', { class: 'kpi td-k' + (go_ ? ' td-go' : ''), type: go_ ? 'button' : null, onclick: go_ ? () => go(go_) : null }, el('b', null, v), el('span', null, label), sub ? el('small', null, sub) : null);
    const summary = D.see ? el('div', { class: 'st-sum' },
      kpi(eurS(sum('mrr')), 'Entrate al mese, tutte le app', per('mrr', geur) || 'Nessun numero ancora'),
      kpi(num(sum('users')), 'Utenti, tutte le app', per('users', num) || 'Nessun numero ancora'),
      kpi(short(sat.views || 0), 'Views delle pagine satellite', sat.accounts ? 'Settimana ' + wkLabel(D.last_week) + (vd != null ? ', ' + (vd > 0 ? '+' : '−') + Math.abs(vd) + '% sulla precedente' : '') : 'Nessuna pagina ancora', 'satellite')) : null;
    rc(body, el('div', { class: 'ov' },
      summary,
      el('div', { class: 'st-apps' }, ...apps.map((a) => appCard(a, D)), CAN('apps') && apps.length < 6 ? el('button', { class: 'st-app st-add', type: 'button', onclick: () => appModal(null) },
        el('b', null, '+ Aggiungi un\'app'), el('span', { class: 'muted', style: 'font-size:12.5px' }, 'Un prodotto vostro o un\'app partner: ha la sua pagina con i grafici.')) : null),
      satCard(D),
      D.see ? null : el('p', { class: 'st-note' }, 'I numeri delle app li vede chi ha il permesso "Lancio e numeri".')));
  }
  function appCard(a, D) {
    const k = a.k, pv = a.prev;
    const kind = a.kind === 'nostra' ? 'Nostra' : 'Partner';
    const kids = [el('div', { class: 'st-app-h' }, appMark(a), el('div', null, el('b', null, a.name), a.tagline ? el('small', null, a.tagline) : null), el('span', { class: 'st-kind' }, kind))];
    if (!D.see) { kids.push(el('div', { class: 'st-foot' }, 'Apri per vedere la pagina dell\'app')); }
    else if (!k) {
      kids.push(el('div', { class: 'st-empty', style: 'padding:14px' }, el('b', null, 'Ancora nessun numero'),
        el('p', { style: 'font-size:12.5px' }, a.source === 'api' ? 'La chiave per il loro server c\'è: i numeri arrivano al primo invio.' : 'Scrivili a mano o collega il loro server dalla pagina dell\'app.')));
    } else {
      const series = (a.series || []).filter((r) => r.mrr != null).map((r) => +r.mrr);
      const dm = pv ? pctDelta(k.mrr, pv.mrr) : null;
      kids.push(el('div', { class: 'st-bigw' }, el('div', { class: 'st-big' }, el('b', null, money(k.mrr)), el('span', null, 'al mese')),
        dm != null ? deltaEl(dm, 'rispetto a 30 giorni fa') : null));
      kids.push(el('div', { class: 'st-trio' },
        el('div', null, el('b', null, fmtM('subs', k.subs)), el('span', null, 'Abbonati')),
        el('div', null, el('b', null, fmtM('users', k.users)), el('span', null, 'Utenti')),
        el('div', null, el('b', null, fmtM('new_users', k.new_users)), el('span', null, 'Nuovi in 30 giorni'))));
      if (series.length > 1) kids.push(spark(series.slice(-60), a.color, 260, 34));
      const g = nextGoal(a.goals, k.mrr);
      if (g) kids.push(goalBar(g, k.mrr, a.color));
      kids.push(el('div', { class: 'st-foot' }, srcText(a, k)));
    }
    return el('button', { class: 'st-app', type: 'button', style: '--ac:' + a.color, onclick: () => go('app:' + a.id) }, ...kids);
  }
  const nextGoal = (goals, mrr) => { const gs = (goals || []).filter((g) => +g.mrr > 0).sort((x, y) => x.mrr - y.mrr); return gs.find((g) => (+mrr || 0) < +g.mrr) || null; };
  function goalBar(g, mrr, color) {
    const p = Math.max(0, Math.min(100, (+mrr || 0) / g.mrr * 100));
    return el('div', { class: 'st-goal', style: '--ac:' + color },
      el('div', { class: 'gh' }, el('span', null, 'Prossimo obiettivo'), el('b', null, eurS(g.mrr) + (g.label ? ' · ' + g.label : '')), el('em', null, (p < 1 && p > 0 ? '<1' : Math.floor(p)) + '%')),
      el('div', { class: 'st-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(g.mrr), 'aria-valuenow': String(+mrr || 0), 'aria-label': 'MRR verso ' + eurS(g.mrr) }, el('i', { style: 'width:' + p + '%' })));
  }
  function srcText(a, k) {
    if (a.source === 'interno') return 'Dal database di NoonFrame, in tempo reale';
    if (!k) return '';
    const d = k.d ? 'dato del ' + longDay(k.d) : '';
    return (k.src === 'api' ? 'Dal loro server' : 'Scritto a mano') + (d ? ', ' + d : '');
  }
  function satCard(D) {
    const s = D.sat || {};
    const open = el('button', { class: 'btn sm', type: 'button', onclick: () => go('satellite') }, 'Apri le pagine');
    if (!s.accounts) {
      return el('section', { class: 'card st-satcard' }, el('div', { class: 'st-sat-h' }, el('h2', null, 'Pagine satellite')),
        el('div', { class: 'st-empty' }, el('b', null, 'Ancora nessuna pagina satellite'),
          el('p', null, 'Aggiungi le pagine con l\'app che spingono e i loro account. Ogni lunedì il team segna i numeri della settimana e qui vedi come crescono.'),
          el('button', { class: 'btn primary', type: 'button', onclick: () => { S.satOpen = 'page'; go('satellite'); } }, 'Vai alle pagine satellite')));
    }
    // views per settimana e per app (ultime 12 settimane chiuse)
    const weeks = []; for (let i = 11; i >= 0; i--) weeks.push(addDays(D.last_week, -7 * i));
    const ids = [...new Set((s.weeks || []).map((r) => r.app || NO_APP.id))];
    const order = (D.apps || []).map((a) => a.id).filter((id) => ids.includes(id)).concat(ids.includes(NO_APP.id) ? [NO_APP.id] : []);
    const series = order.map((id) => ({ name: nameOf(id), color: colorOf(id), values: Object.fromEntries((s.weeks || []).filter((r) => (r.app || NO_APP.id) === id).map((r) => [r.w, +r.v || 0])) }));
    const vd = pctDelta(s.views, s.views_prev);
    return el('section', { class: 'card st-satcard' },
      el('div', { class: 'st-sat-h' }, el('h2', { class: 'grow' }, 'Pagine satellite'), open),
      el('div', { class: 'st-sat-n' }, el('b', null, num(s.views || 0)), el('span', null, 'views la settimana ' + wkLabel(D.last_week)), deltaEl(vd, 'sulla precedente')),
      el('div', { class: 'st-trio', style: 'max-width:560px;border-top:0;padding-top:0' },
        el('div', null, el('b', null, num(s.posts || 0)), el('span', null, 'Post la settimana')),
        el('div', null, el('b', null, short(s.followers || 0)), el('span', null, 'Follower in tutto')),
        el('div', null, el('b', { class: s.followers_gain > 0 ? 'gr-up' : '' }, (s.followers_gain > 0 ? '+' : '') + short(s.followers_gain || 0)), el('span', null, 'Follower in 4 settimane'))),
      series.length ? stackChart(weeks, series, { label: 'Views delle pagine satellite per settimana' }) : el('p', { class: 'muted', style: 'margin:0' }, 'I numeri arrivano quando il team li segna.'),
      s.missing ? el('div', { class: 'st-nudge' }, el('span', null, s.missing + (s.missing === 1 ? ' account attivo non ha' : ' account attivi non hanno') + ' i numeri della settimana ' + wkLabel(D.last_week) + '.'),
        el('button', { class: 'btn sm primary', type: 'button', onclick: () => { S.satOpen = 'week'; go('satellite'); } }, 'Segna i numeri')) : null);
  }

  // ---------------------------------------------------------------- pagina di un'app
  const NF_TOOLS = [['today', 'Oggi'], ['overview', 'Uso dell\'app'], ['users', 'Utenti'], ['reports', 'Segnalazioni'], ['site', 'Sito'], ['launch', 'Lancio'],
    ['revenue', 'Fatturato'], ['webclip', 'Clip dal web'], ['shop', 'Crediti e offerte'], ['updates', 'Aggiornamenti']];
  function renderApp(main) {
    const id = S.view.slice(4);
    const D = S.appd[id];
    const a = (D && D.app) || appOf(id);
    if (!a) { rc(main, head('App'), el('div', { class: 'body' }, S.err ? el('div', { class: 'err' }, S.err) : el('div', { class: 'loading' }, 'Caricamento…'))); return; }
    const edit = D && D.can_edit;
    const btns = [];
    if (edit && a.source !== 'interno') {
      btns.push(el('button', { class: 'btn primary', type: 'button', onclick: () => metricsModal(a, D, null) }, 'Scrivi i numeri'));
      btns.push(el('button', { class: 'btn', type: 'button', onclick: () => connModal(a, D) }, a.source === 'api' ? 'Server collegato' : 'Collega il loro server'));
    }
    if (edit) btns.push(el('button', { class: 'btn ghost', type: 'button', onclick: () => appModal(D.app) }, 'Modifica'));
    const hdr = el('div', { class: 'head st-apphead', style: '--ac:' + a.color },
      el('div', { class: 'ttl' }, el('div', { class: 'st-ah' }, appMark(a, 'lg'), el('h1', null, a.name), el('span', { class: 'st-kind' }, a.kind === 'nostra' ? 'Nostra' : 'Partner')),
        el('p', null, [a.tagline, a.site ? a.site.replace(/^https:\/\//, '') : null].filter(Boolean).join(' — '))), ...btns);
    const body = el('div', { class: 'body' });
    rc(main, hdr, body);
    if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
    if (!D) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
    if (a.source === 'interno') { renderNoonFrame(body, a); return; }
    renderPartner(body, a, D);
  }
  function latestBy(rows) {
    const out = {}, at = {};
    for (const [k] of APP_M) for (let i = rows.length - 1; i >= 0; i--) if (rows[i][k] != null) { out[k] = +rows[i][k]; at[k] = rows[i].d; break; }
    return { k: out, at };
  }
  function prevBy(rows, at) {
    const out = {};
    for (const [k] of APP_M) { if (!at[k]) continue; const cut = addDays(at[k], -25); for (let i = rows.length - 1; i >= 0; i--) if (rows[i].d <= cut && rows[i][k] != null) { out[k] = +rows[i][k]; break; } }
    return out;
  }
  function kpiRow(k, prev, color, at, lastDay) {
    const tile = (key, label) => {
      const p = prev && prev[key] != null ? pctDelta(k[key], prev[key]) : null;
      const old = at && at[key] && lastDay && at[key] !== lastDay ? 'al ' + longDay(at[key]) : null;
      return el('div', { class: 'kpi' }, el('b', null, fmtM(key, k[key])), el('span', null, label), p != null || old ? el('small', null, p != null ? deltaEl(p, 'in 30 giorni') : null, p != null && old ? ' · ' : null, old) : null);
    };
    return el('div', { class: 'kpis st-kpis', style: '--ac:' + color },
      tile('mrr', 'Entrate al mese (MRR)'), tile('subs', 'Abbonati'), k.trials != null ? tile('trials', 'In prova') : null, tile('users', 'Utenti'),
      k.active != null ? tile('active', 'Attivi in 30 giorni') : null, tile('new_users', 'Nuovi in 30 giorni'), tile('revenue', 'Incassi in 30 giorni'));
  }
  function renderNoonFrame(body, a) {
    const st = S.st && (S.st.apps || []).find((x) => x.id === a.id);
    const tools = NF_TOOLS.filter(([v]) => allowed(v)).map(([v, l]) => el('button', { class: 'st-tool', type: 'button', onclick: () => go(v) }, el('b', null, l), el('small', null, SUB[l] || '')));
    rc(body, el('div', { class: 'ov' },
      st && st.k ? kpiRow(st.k, st.prev, a.color) : null,
      CAN('launch') ? growthBox() : null,
      tools.length ? el('section', { class: 'card' }, el('h2', null, 'Gli strumenti di NoonFrame'), el('div', { class: 'st-tools' }, ...tools)) : null,
      el('p', { class: 'st-note' }, 'I numeri di NoonFrame arrivano dal suo database, senza gli account del team e di prova.')));
  }
  function renderPartner(body, a, D) {
    const rows = D.rows || [];
    const last = rows[rows.length - 1] || null;
    const L = latestBy(rows), prev = prevBy(rows, L.at);
    const conn = connCard(a, D);
    if (!rows.length) {
      rc(body, el('div', { class: 'ov' },
        el('div', { class: 'st-empty' }, el('b', null, 'Ancora nessun numero di ' + a.name),
          el('p', null, D.can_edit ? 'Puoi scriverli a mano (MRR, abbonati, utenti) quando li hai, oppure collegare il loro server: una chiamata al giorno e i grafici si riempiono da soli.' : 'Quando qualcuno del team scrive i numeri o collega il loro server, qui compaiono MRR, abbonati e utenti.'),
          D.can_edit ? el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'button', onclick: () => metricsModal(a, D, null) }, 'Scrivi i primi numeri'),
            el('button', { class: 'btn', type: 'button', onclick: () => connModal(a, D) }, 'Collega il loro server')) : null),
        goalsCard(a, D, null), conn));
      return;
    }
    S.apm = S.apm || {};
    const avail = APP_M.filter(([k]) => rows.some((r) => r[k] != null));
    let m = S.apm[a.id] && avail.some((x) => x[0] === S.apm[a.id]) ? S.apm[a.id] : (avail[0] || APP_M[0])[0];
    const chartBox = el('section', { class: 'card st-chartcard', style: '--ac:' + a.color });
    const paint = () => {
      const M = APP_M.find((x) => x[0] === m);
      const pts = rows.filter((r) => r[m] != null).map((r) => ({ d: r.d, v: +r[m], note: r.src === 'api' ? 'dal loro server' : 'a mano' }));
      const g = m === 'mrr' ? nextGoal(D.app.goals, L.k.mrr) : null;
      const tabs = el('div', { class: 'st-tabs', role: 'tablist' }, ...avail.map(([k, l]) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(k === m), onclick: () => { m = k; S.apm[a.id] = k; paint(); } }, l)));
      const lastPt = pts[pts.length - 1];
      rc(chartBox, el('div', { class: 'row gr-head' }, el('h2', { class: 'grow', style: 'margin:0' }, 'Andamento'), el('span', { class: 'muted', style: 'font-size:12px' }, pts.length + (pts.length === 1 ? ' dato' : ' dati'))),
        tabs,
        el('div', { class: 'gr-big' }, el('b', null, lastPt ? (M[3] ? eurS(lastPt.v) : num(lastPt.v)) : '—'), el('small', { class: 'muted' }, M[2] + (lastPt ? ' · al ' + longDay(lastPt.d) : ''))),
        pts.length ? lineChart(pts, { color: a.color, money: M[3], name: M[1], label: M[2] + ' di ' + a.name, goal: g ? { v: +g.mrr, label: 'Obiettivo ' + eurS(g.mrr) + (g.label ? ' (' + g.label + ')' : '') } : null })
          : el('p', { class: 'muted' }, 'Nessun dato per questo numero.'),
        pts.length === 1 ? el('p', { class: 'st-note' }, 'Con il prossimo dato compare la linea.') : null);
    };
    paint();
    const tbl = el('div', { class: 'tblwrap gr-tbl st-tblw' }, el('table', { class: 'tbl st-tbl' },
      el('thead', null, el('tr', null, el('th', null, 'Giorno'), ...APP_M.map(([k, l]) => el('th', { class: 'num' + (k === 'trials' || k === 'active' ? ' hide-m' : '') }, l)), el('th', null, 'Da'))),
      el('tbody', null, ...rows.slice().reverse().map((r) => el('tr', { class: D.can_edit ? 'ed' : '', title: D.can_edit ? 'Modifica' : null, onclick: D.can_edit ? () => metricsModal(a, D, r) : null },
        el('td', null, longDay(r.d)), ...APP_M.map(([k]) => el('td', { class: 'num' + (k === 'trials' || k === 'active' ? ' hide-m' : '') }, fmtM(k, r[k]))),
        el('td', null, el('span', { class: 'st-src' + (r.src === 'api' ? ' api' : '') }, r.src === 'api' ? 'server' : 'a mano')))))));
    rc(body, el('div', { class: 'ov' },
      kpiRow(L.k, prev, a.color, L.at, last.d),
      el('p', { class: 'st-note', style: 'margin-top:-8px' }, 'Ultimo dato del ' + longDay(last.d) + (last.src === 'api' ? ', arrivato dal loro server.' : ', scritto a mano.')),
      chartBox,
      goalsCard(a, D, L.k),
      el('section', { class: 'card' }, el('h2', null, 'Tutti i dati', D.can_edit ? el('span', { class: 'muted', style: 'font-weight:500;font-size:12px' }, 'Clicca una riga per correggerla') : null), tbl),
      conn));
  }
  function goalsCard(a, D, last) {
    const gs = ((D.app && D.app.goals) || []).filter((g) => +g.mrr > 0);
    if (!D.can_own || !gs.length) return null;
    const mrr = last ? +last.mrr || 0 : 0;
    return el('section', { class: 'card' }, el('h2', null, 'Obiettivi dell\'accordo', D.app.stake ? el('span', { class: 'muted', style: 'font-weight:500;font-size:12px' }, D.app.stake) : null),
      el('div', { style: 'display:grid;gap:12px' }, ...gs.map((g) => {
        const done = mrr >= +g.mrr, p = Math.max(0, Math.min(100, mrr / g.mrr * 100));
        return el('div', { class: 'st-goal', style: '--ac:' + a.color },
          el('div', { class: 'gh' }, el('b', null, eurS(g.mrr) + ' di MRR'), el('span', null, g.label || ''), done ? el('span', { class: 'pill done', style: 'margin-left:auto' }, 'Raggiunto') : el('em', null, (p < 1 && p > 0 ? '<1' : Math.floor(p)) + '%')),
          el('div', { class: 'st-bar' }, el('i', { style: 'width:' + p + '%' })));
      })),
      el('p', { class: 'st-note', style: 'margin-top:10px' }, 'Lo vedi solo tu. Gli obiettivi si cambiano da "Modifica".'));
  }
  function connCard(a, D) {
    if (!D.can_edit) return null;
    const ap = D.app;
    const state = ap.source === 'api'
      ? el('div', { class: 'st-state ' + (ap.last_push ? 'ok' : 'wait') }, el('i'), el('span', null, ap.last_push ? 'Collegato: l\'ultimo invio dal loro server è arrivato ' + when(ap.last_push) + '.' : 'La chiave c\'è (finisce con …' + ap.token_hint + '), ma dal loro server non è ancora arrivato niente.'))
      : el('div', { class: 'st-state' }, el('i'), el('span', null, 'Per ora i numeri si scrivono a mano.'));
    return el('section', { class: 'card st-conn' }, el('h2', { style: 'margin:0' }, 'Da dove arrivano i numeri'), state,
      el('p', { class: 'st-note' }, 'Con la chiave il loro server manda ogni giorno MRR, abbonati e utenti a questo pannello: niente accessi al loro database, solo i numeri.'),
      el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: () => connModal(a, D) }, ap.source === 'api' ? 'Istruzioni e chiave' : 'Collega il loro server')));
  }
  async function reloadApp(id) { try { S.appd[id] = await sql('app', { id }); S.st = null; S.err = null; } catch (e) { toast(explain(e)); } if (S.view === 'app:' + id) render(); }

  function metricsModal(a, D, row) {
    const today = D.today, isNew = !row;
    const rowOf = (d) => (D.rows || []).find((r) => r.d === d) || null;
    const base = row || rowOf(today) || {};
    const last = (D.rows || []).slice(-1)[0] || {};
    const day = inp({ type: 'date', value: base.d || today, max: today });
    const box = {};
    const fields = APP_M.map(([k, l, hint, isMoney]) => {
      box[k] = inp({ inputmode: 'decimal', value: inVal(base[k], isMoney), placeholder: last[k] != null ? 'ultimo: ' + (isMoney ? String(last[k]).replace('.', ',') : num(last[k])) : '' });
      return fld(l + (isMoney ? ' (€)' : ''), box[k], hint);
    });
    // cambiando giorno si vedono i numeri già salvati per quel giorno (si modificano, non si cancellano)
    day.addEventListener('change', () => { if (row) return; const r = rowOf(day.value) || {}; APP_M.forEach(([k, , , isMoney]) => { box[k].value = inVal(r[k], isMoney); }); });
    stModal(isNew ? 'Numeri di ' + a.name : 'Dato del ' + longDay(row.d), [
      el('p', { class: 'muted', style: 'margin:0;font-size:13px' }, 'Scrivi quelli che hai, gli altri lasciali vuoti. Vale come foto di quel giorno: puoi scrivere "12.500" o "12,5k".'),
      el('div', { class: 'st-fields' }, fld('Giorno', day), el('span'), ...fields),
    ], (close) => [
      !isNew ? btnArm('Cancella il dato', 'Conferma: cancella', async () => { await sql('app_save', { op: 'metrics_remove', id: a.id, day: row.d }); close(); toast('Dato cancellato'); reloadApp(a.id); }) : null,
      el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
      el('button', { class: 'btn primary', type: 'button', onclick: async (e) => { const bt = e.currentTarget;
        const arg = { op: 'metrics', id: a.id, day: day.value };
        let bad = null, any = false;
        for (const [k, l, , isMoney] of APP_M) { const r = parseN(box[k].value, isMoney); box[k].classList.toggle('bad', !r.ok); if (!r.ok) bad = bad || l; else { arg[k] = r.v == null ? '' : String(r.v); if (r.v != null) any = true; } }
        if (bad) { toast('Controlla il numero: ' + bad); return; }
        if (!any) { toast('Scrivi almeno un numero'); return; }
        if (!isNew && row.d !== day.value && (D.rows || []).some((r) => r.d === day.value)) { if (!confirm('Per quel giorno c\'è già un dato: lo sostituisco?')) return; }
        bt.disabled = true;
        try {
          await sql('app_save', arg);
          if (!isNew && row.d !== day.value) await sql('app_save', { op: 'metrics_remove', id: a.id, day: row.d });
          close(); toast('Numeri salvati'); reloadApp(a.id);
        } catch (er) { toast(explain(er)); bt.disabled = false; }
      } }, 'Salva'),
    ], 'narrow');
    (isNew ? box.mrr : day).focus();
  }

  function devText(a, token) {
    return 'Ciao! Per vedere i numeri di ' + a.name + ' nel nostro pannello ci basta una chiamata al giorno dal vostro server (va bene un cron alle 6 di mattina).\n\n'
      + 'URL: ' + PUSH_URL + '\n'
      + 'Header: apikey: ' + SB_KEY + '\n'
      + 'Header: Content-Type: application/json\n\n'
      + 'Corpo (tutti i campi sono facoltativi tranne token, valori in euro):\n'
      + '{\n  "token": "' + (token || 'LA_CHIAVE_CHE_TI_MANDO_A_PARTE') + '",\n  "data": {\n'
      + '    "mrr": 262.50,        // entrate ricorrenti al mese (abbonamenti attivi, mensili + annuali/12)\n'
      + '    "subs": 33,           // abbonamenti attivi a pagamento\n'
      + '    "trials": 4,          // prove gratuite attive\n'
      + '    "users": 1420,        // utenti totali registrati\n'
      + '    "active": 610,        // utenti attivi negli ultimi 30 giorni\n'
      + '    "new_users": 180,     // nuovi utenti negli ultimi 30 giorni\n'
      + '    "revenue": 300.00     // incassi lordi degli ultimi 30 giorni\n'
      + '  }\n}\n\n'
      + 'Se mandate due volte nello stesso giorno, vale l\'ultima. Per un giorno passato aggiungete "day": "2026-10-20" dentro data.\n'
      + 'Se usate RevenueCat potete prendere MRR, abbonamenti, prove, incassi, nuovi clienti e clienti attivi da GET https://api.revenuecat.com/v2/projects/{project_id}/metrics/overview?currency=EUR (permesso charts_metrics:overview:read).\n'
      + 'La chiave serve solo a mandare questi numeri: non dà accesso a nient\'altro.';
  }
  function connModal(a, D) {
    const ap = D.app;
    let token = null;
    const tokBox = el('div');
    const curl = () => 'curl -X POST \'' + PUSH_URL + '\' \\\n  -H \'apikey: ' + SB_KEY + '\' \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"token":"' + (token || 'nfm_…') + '","data":{"mrr":262.5,"subs":33,"users":1420}}\'';
    const code = el('pre', { class: 'st-code' }, curl());
    const paintTok = () => {
      rc(tokBox, token
        ? el('div', { style: 'display:grid;gap:8px' }, el('div', { class: 'st-state ok' }, el('i'), el('span', null, 'Ecco la chiave. Copiala adesso: per sicurezza non si può rivedere, se la perdi se ne crea una nuova.')),
          el('div', { class: 'st-key' }, token), el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: () => copy(token, 'Chiave copiata') }, 'Copia la chiave'),
            el('button', { class: 'btn', type: 'button', onclick: () => copy(devText(a, token), 'Istruzioni copiate: mandale allo sviluppatore') }, 'Copia le istruzioni per lo sviluppatore')))
        : ap.source === 'api'
          ? el('div', { class: 'st-state ' + (ap.last_push ? 'ok' : 'wait') }, el('i'), el('span', null, 'Chiave attiva (finisce con …' + ap.token_hint + ', creata ' + when(ap.token_at) + '). ' + (ap.last_push ? 'Ultimo invio ' + when(ap.last_push) + '.' : 'Ancora nessun invio.')))
          : el('div', { class: 'st-state' }, el('i'), el('span', null, 'Nessuna chiave: per ora i numeri si scrivono a mano.')));
      code.textContent = curl();
    };
    paintTok();
    const mk = el('button', { class: 'btn primary', type: 'button', onclick: async (e) => { const bt = e.currentTarget;
      if (ap.source === 'api' && !confirm('Creo una chiave nuova? Quella di prima smette subito di funzionare.')) return;
      bt.disabled = true;
      try { const r = await sql('app_save', { op: 'token', id: a.id }); token = r.token; ap.source = 'api'; ap.token_hint = r.token_hint; ap.token_at = r.token_at; paintTok(); mk.textContent = 'Crea una chiave nuova'; S.appd[a.id] = null; S.st = null; }
      catch (er) { toast(explain(er)); }
      bt.disabled = false;
    } }, ap.source === 'api' ? 'Crea una chiave nuova' : 'Crea la chiave');
    stModal('Collega il server di ' + a.name, [
      el('p', { style: 'margin:0;color:var(--text2)' }, 'Il loro server manda i numeri una volta al giorno con una chiave che crei qui. La chiave serve solo a scrivere i numeri di ' + a.name + ': non apre nient\'altro del pannello.'),
      tokBox,
      el('div', { class: 'row' }, mk, el('button', { class: 'btn', type: 'button', onclick: () => copy(devText(a, token), 'Istruzioni copiate: la chiave mandala a parte') }, 'Copia le istruzioni (senza chiave)')),
      el('details', { class: 'box', style: 'margin:0' }, el('summary', null, 'Esempio per lo sviluppatore'), code),
    ], (close) => [
      ap.source === 'api' ? btnArm('Togli la chiave', 'Conferma: togli', async () => { await sql('app_save', { op: 'token_revoke', id: a.id }); close(); toast('Chiave tolta: si torna a scrivere a mano'); reloadApp(a.id); }) : null,
      el('button', { class: 'btn', type: 'button', onclick: () => { close(); reloadApp(a.id); } }, 'Fatto'),
    ]);
  }

  function appModal(app) {
    const isNew = !app, own = CAN('founders');
    app = app || { name: '', kind: 'partner', tagline: '', site: '', color: APP_COLORS[((S.apps || []).length) % APP_COLORS.length][0], stake: '', goals: [] };
    const name = inp({ value: app.name, maxlength: '60', placeholder: 'Nome dell\'app' });
    const kind = el('select', { class: 'search', disabled: app.id === 'noonframe' }, el('option', { value: 'nostra', selected: app.kind === 'nostra' }, 'Nostra (la facciamo noi)'), el('option', { value: 'partner', selected: app.kind === 'partner' }, 'Partner (ne abbiamo una quota)'));
    const tag = inp({ value: app.tagline || '', maxlength: '140', placeholder: 'Cosa fa, in una riga' });
    const site = inp({ type: 'url', value: app.site || '', maxlength: '300', placeholder: 'https://…' });
    const cur = String(app.color || '').toUpperCase();
    const sw = el('div', { class: 'st-sw', role: 'radiogroup', 'aria-label': 'Colore dell\'app' }, ...APP_COLORS.map(([c, l], i) =>
      el('label', { title: l }, el('input', { type: 'radio', name: 'appcol', value: c, checked: cur === c || (!APP_COLORS.some((x) => x[0] === cur) && i === 0), 'aria-label': l }), el('span', { style: '--sc:' + c }))));
    const stake = own ? inp({ value: app.stake || '', maxlength: '80', placeholder: 'es. 12% in vesting + bonus fino al 22%' }) : null;
    const goalsBox = el('div', { class: 'st-goals' });
    const goalRow = (g) => {
      const v = inp({ inputmode: 'decimal', value: g && g.mrr ? String(g.mrr) : '', placeholder: 'MRR (€)', style: 'width:120px' });
      const l = inp({ value: (g && g.label) || '', maxlength: '60', placeholder: 'Cosa succede (es. +2% di quote)', style: 'flex:1' });
      const r = el('div', { class: 'row' }, v, l, el('button', { class: 'iconbtn', type: 'button', title: 'Togli', 'aria-label': 'Togli obiettivo', onclick: () => r.remove() }, '×'));
      r._v = v; r._l = l; return r;
    };
    (app.goals || []).forEach((g) => goalsBox.append(goalRow(g)));
    const kids = [
      el('div', { class: 'st-fields' }, fld('Nome', name), fld('Tipo', kind)),
      fld('Descrizione', tag), fld('Sito', site, 'Facoltativo'), fld('Colore', sw, 'Lo usano i grafici e il menu. I colori sono scelti per restare distinguibili tra loro.'),
    ];
    if (own) kids.push(fld('Quota', stake, 'La vedi solo tu'), el('div', { class: 'fld' }, el('span', null, 'Obiettivi di MRR'), goalsBox,
      el('button', { class: 'btn sm', type: 'button', style: 'align-self:flex-start', onclick: () => goalsBox.append(goalRow(null)) }, '+ Obiettivo'),
      el('small', { class: 'muted' }, 'Compaiono come traguardi nella pagina dell\'app e nella Panoramica. Li vedi solo tu.')));
    stModal(isNew ? 'Nuova app' : 'Modifica ' + app.name, kids, (close) => [
      !isNew && app.id !== 'noonframe' ? btnArm('Togli l\'app', 'Conferma: togli', async () => {
        await sql('app_save', { op: 'app_remove', id: app.id, title: app.name }); close(); toast('App tolta'); S.st = null; delete S.appd[app.id]; await navApps(true); go('home');
      }) : null,
      el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
      el('button', { class: 'btn primary', type: 'button', onclick: async (e) => { const bt = e.currentTarget;
        const arg = { op: 'app', id: isNew ? null : app.id, name: name.value.trim(), kind: kind.value, tagline: tag.value.trim(), site: site.value.trim(), color: (sw.querySelector('input:checked') || {}).value, title: name.value.trim() };
        if (!arg.name) { toast('Scrivi il nome'); name.focus(); return; }
        if (own) {
          arg.stake = stake.value.trim();
          const goals = []; let bad = false;
          goalsBox.querySelectorAll('.row').forEach((r) => { const p = parseN(r._v.value, true); if (!p.ok || (r._v.value.trim() && !p.v)) bad = true; else if (p.v) goals.push({ mrr: p.v, label: r._l.value.trim() }); });
          if (bad) { toast('Controlla gli importi degli obiettivi'); return; }
          arg.goals = goals;
        }
        bt.disabled = true;
        try {
          const r = await sql('app_save', arg);
          close(); toast(isNew ? 'App aggiunta' : 'App salvata');
          S.st = null; S.appd[r.id] = null; await navApps(true);
          if (isNew) go('app:' + r.id); else if (S.view === 'app:' + r.id) load(S.view, true); else render();
        } catch (er) { toast(explain(er)); bt.disabled = false; }
      } }, isNew ? 'Aggiungi' : 'Salva'),
    ], 'narrow');
    name.focus();
  }

  // ---------------------------------------------------------------- Pagine satellite
  function satModel(D) {
    const lastW = addDays(D.week, -7);
    const by = {};
    (D.nums || []).forEach((n) => { (by[n.a] = by[n.a] || {})[n.w] = n; });
    const pageOf = Object.fromEntries((D.pages || []).map((p) => [p.id, p]));
    const canEditPage = (p) => !!p && (D.can_manage || p.manager === D.me);
    const accs = (D.accounts || []).map((x) => {
      const pg = pageOf[x.page_id]; const nb = by[x.id] || {};
      const wks = Object.keys(nb).sort();
      const fWeeks = wks.filter((w) => nb[w].f != null);
      const lastF = fWeeks.length ? nb[fWeeks[fWeeks.length - 1]].f : null;
      const f4w = fWeeks.filter((w) => w <= addDays(lastW, -28)); const f4 = f4w.length ? nb[f4w[f4w.length - 1]].f : null;
      return { ...x, page: pg, app: (pg && pg.app) || NO_APP.id, nums: nb, lastF, gain: lastF != null && f4 != null ? lastF - f4 : null,
        lw: nb[lastW] || null, pw: nb[addDays(lastW, -7)] || null, editable: canEditPage(pg) };
    });
    return { lastW, accs, pageOf, canEditPage };
  }
  function renderSat(main) {
    S.satw = S.satw || 12; S.satf = S.satf || 'all'; S.satm = S.satm || 'v';
    const D0 = S.sat;
    const seg = el('div', { class: 'seg' }, ...[[8, '8 settimane'], [12, '12'], [26, '26']].map(([w, l]) => el('button', { type: 'button', 'aria-pressed': String(S.satw === w),
      onclick: async () => { S.satw = w; S.sat = null; renderSat(main); try { S.sat = await sql('sat', { weeks: w }); S.err = null; } catch (e) { S.err = explain(e); } renderSat(main); } }, l)));
    const M0 = D0 ? satModel(D0) : null;
    const editable = M0 ? M0.accs.filter((a) => a.editable) : [];
    const addPage = D0 && D0.can_manage ? el('button', { class: 'btn', type: 'button', onclick: () => pageModal(null) }, '+ Pagina') : null;
    const weekBtn = el('button', { class: 'btn primary', type: 'button', disabled: !editable.length, title: editable.length ? null : 'Non ci sono account che puoi aggiornare', onclick: () => weekModal(null) }, 'Segna i numeri');
    const body = el('div', { class: 'body' });
    rc(main, head('Pagine satellite', seg, addPage, weekBtn), body);
    if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
    const D = S.sat; if (!D) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
    const M = M0;
    // aperture chieste da altre pagine (Panoramica)
    if (S.satOpen) { const what = S.satOpen; S.satOpen = null; setTimeout(() => { if (what === 'page' && D.can_manage) pageModal(null); if (what === 'week' && editable.length) weekModal(null); }, 0); }
    if (!(D.pages || []).length) {
      rc(body, el('div', { class: 'sat-body' }, el('div', { class: 'st-empty' }, el('b', null, 'Ancora nessuna pagina satellite'),
        el('p', null, 'Una pagina è un progetto di contenuti (es. "Soldi con l\'AI") che spinge un\'app, con i suoi account su TikTok, Instagram, YouTube. Ogni lunedì chi la gestisce segna follower, views e post della settimana.'),
        D.can_manage ? el('button', { class: 'btn primary', type: 'button', onclick: () => pageModal(null) }, '+ Aggiungi la prima pagina') : el('p', { class: 'muted' }, 'Le pagine le aggiunge chi ha il permesso "Pagine satellite: gestirle tutte".'))));
      return;
    }
    // filtro per app
    const present = [...new Set(M.accs.map((a) => a.app).concat((D.pages || []).map((p) => p.app || NO_APP.id)))];
    const order = (D.apps || []).map((a) => a.id).filter((id) => present.includes(id)).concat(present.includes(NO_APP.id) ? [NO_APP.id] : []);
    if (S.satf !== 'all' && !order.includes(S.satf)) S.satf = 'all';
    const inF = (appId) => S.satf === 'all' || appId === S.satf;
    const accs = M.accs.filter((a) => inF(a.app));
    const chips = order.length > 1 ? el('div', { class: 'sat-filters', role: 'group', 'aria-label': 'Filtra per app' },
      el('button', { class: 'sat-chip', type: 'button', 'aria-pressed': String(S.satf === 'all'), onclick: () => { S.satf = 'all'; renderSat(main); } }, 'Tutte', el('em', null, M.accs.length)),
      ...order.map((id) => el('button', { class: 'sat-chip', type: 'button', style: '--sc:' + colorOf(id), 'aria-pressed': String(S.satf === id), onclick: () => { S.satf = id; renderSat(main); } },
        el('i'), nameOf(id), el('em', null, M.accs.filter((a) => a.app === id).length)))) : null;

    // numeri in alto (ultima settimana chiusa)
    const sumW = (k, w) => accs.reduce((s, a) => s + (+((a.nums[w] || {})[k]) || 0), 0);
    const vLW = sumW('v', M.lastW), vPW = sumW('v', addDays(M.lastW, -7));
    const live = accs.filter((a) => a.status === 'attivo');
    const missing = live.filter((a) => !a.lw);
    const fol = accs.reduce((s, a) => s + (+a.lastF || 0), 0), gain = accs.reduce((s, a) => s + (+a.gain || 0), 0);
    const vd = pctDelta(vLW, vPW);
    const kpi = (v, label, sub, cls, onclick) => el(onclick ? 'button' : 'div', { class: 'kpi td-k' + (cls ? ' ' + cls : '') + (onclick ? ' td-go' : ''), type: onclick ? 'button' : null, onclick }, el('b', null, v), el('span', null, label), sub ? el('small', null, sub) : null);
    const kpis = el('div', { class: 'kpis' },
      kpi(short(vLW), 'Views la settimana scorsa', vd != null ? el('span', { class: 'st-delta ' + (vd > 0 ? 'pos' : vd < 0 ? 'neg' : '') }, (vd > 0 ? '+' : vd < 0 ? '−' : '') + Math.abs(vd) + '% sulla settimana prima') : wkLabel(M.lastW)),
      kpi(short(fol), 'Follower in tutto', gain ? (gain > 0 ? '+' : '') + num(gain) + ' nelle ultime 4 settimane' : 'Somma dell\'ultimo numero di ogni account'),
      kpi(num(sumW('p', M.lastW)), 'Post la settimana scorsa', live.length + (live.length === 1 ? ' account attivo' : ' account attivi')),
      kpi(num(missing.length), 'Da aggiornare', missing.length ? 'account senza i numeri della settimana ' + wkLabel(M.lastW) : 'Tutti aggiornati', missing.length ? 'hot' : '', missing.some((a) => a.editable) ? () => weekModal(null) : null));

    // grafico per settimana
    const weeks = []; for (let w = D.since; w <= M.lastW; w = addDays(w, 7)) weeks.push(w);
    if ((D.nums || []).some((n) => n.w === D.week)) weeks.push(D.week);
    const ids = S.satf === 'all' ? order : [S.satf];
    const valOf = (a, w, k) => {
      if (k !== 'f') { const n = a.nums[w]; return n && n[k] != null ? +n[k] : null; }
      const ws = Object.keys(a.nums).filter((x) => x <= w && a.nums[x].f != null).sort();   // follower: vale l'ultimo numero segnato
      return ws.length ? +a.nums[ws[ws.length - 1]].f : null;
    };
    const series = ids.map((id) => {
      const list = accs.filter((a) => a.app === id);
      const values = {};
      weeks.forEach((w) => { let any = false, s = 0; list.forEach((a) => { const v = valOf(a, w, S.satm); if (v != null) { any = true; s += v; } }); if (any) values[w] = s; });
      return { name: nameOf(id), color: colorOf(id), values };
    });
    const shown = series.filter((sr) => Object.keys(sr.values).length);
    const mSeg = el('div', { class: 'seg' }, ...SAT_M.slice(0, 3).map(([k, l]) => el('button', { type: 'button', 'aria-pressed': String(S.satm === k), onclick: () => { S.satm = k; renderSat(main); } }, l)));
    const hasData = shown.length > 0;
    const chart = el('section', { class: 'card st-chartcard' },
      el('div', { class: 'row gr-head' }, el('h2', { class: 'grow', style: 'margin:0' }, (SAT_M.find((x) => x[0] === S.satm) || SAT_M[0])[1] + ' a settimana'), mSeg),
      hasData ? stackChart(weeks, shown, { label: 'Numeri delle pagine satellite per settimana' }) : el('p', { class: 'muted', style: 'margin:0' }, 'Ancora nessun numero: arrivano quando il team li segna.'),
      el('p', { class: 'st-note' }, S.satm === 'f' ? 'Follower: per ogni account vale l\'ultimo numero segnato fino a quella settimana.' : 'Le settimane vanno da lunedì a domenica. I numeri li segna chi gestisce la pagina.'));

    const nudge = missing.length && missing.some((a) => a.editable) ? el('div', { class: 'st-nudge' },
      el('span', null, 'Mancano i numeri della settimana ' + wkLabel(M.lastW) + ' per ' + missing.length + (missing.length === 1 ? ' account.' : ' account.')),
      el('button', { class: 'btn sm primary', type: 'button', onclick: () => weekModal(null) }, 'Segna i numeri')) : null;

    // pagine raggruppate per app
    const pages = (D.pages || []).filter((p) => inF(p.app || NO_APP.id));
    const groups = order.filter((id) => inF(id)).map((id) => {
      const ps = pages.filter((p) => (p.app || NO_APP.id) === id); if (!ps.length) return null;
      const a = id === NO_APP.id ? NO_APP : appOf(id) || { id, name: id, color: NO_APP.color };
      return el('section', { class: 'sat-group' }, el('h3', { class: 'sat-gh' }, appMark(a, 'sm'), a.name, el('small', null, ps.length + (ps.length === 1 ? ' pagina' : ' pagine'))),
        ...ps.map((p) => pageCard(p, M, D)));
    });
    rc(body, el('div', { class: 'sat-body' }, chips, kpis, nudge, chart, ...groups,
      el('p', { class: 'st-note' }, 'I numeri si prendono dalle statistiche di ogni app (ultimi 7 giorni) il lunedì. ' + (D.can_access ? 'Gli accessi sono cifrati: ogni volta che qualcuno ne apre uno resta scritto nel registro in "Team e permessi".' : 'Gli accessi degli account li vede solo chi ha il permesso.'))));
  }
  function pageCard(p, M, D) {
    const accs = M.accs.filter((a) => a.page_id === p.id);
    const canEdit = M.canEditPage(p);
    const weeksBack = []; for (let i = 7; i >= 0; i--) weeksBack.push(addDays(M.lastW, -7 * i));
    const mgr = p.manager ? el('span', { class: 'sat-mgr' }, el('span', { class: 'av' }, memberName(p.manager, D.members).charAt(0).toUpperCase()), memberName(p.manager, D.members)) : el('span', { class: 'sat-mgr muted' }, 'Nessuno la gestisce');
    const head_ = el('div', { class: 'sat-ph' }, el('div', null, el('b', null, p.name), p.niche ? el('small', null, p.niche) : null), mgr,
      canEdit ? el('button', { class: 'btn sm', type: 'button', onclick: () => accountModal(null, p) }, '+ Account') : null,
      canEdit ? el('button', { class: 'iconbtn', type: 'button', title: 'Modifica la pagina', 'aria-label': 'Modifica la pagina ' + p.name, onclick: () => pageModal(p) }, '⋯') : null);
    if (!accs.length) return el('div', { class: 'sat-page' }, head_, el('div', { class: 'sat-none' }, canEdit ? 'Nessun account: aggiungi i profili TikTok, Instagram o YouTube di questa pagina.' : 'Nessun account in questa pagina.'));
    const rows = accs.map((a) => {
      const st = STATUS[a.status] || [a.status, 'no'];
      const link = a.url ? el('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, '@' + a.handle) : el('span', { class: 'h' }, '@' + a.handle);
      const v = a.lw && a.lw.v != null ? short(a.lw.v) : null, po = a.lw && a.lw.p != null ? num(a.lw.p) : null;
      const vd = a.lw && a.pw && a.lw.v != null && a.pw.v != null ? pctDelta(a.lw.v, a.pw.v) : null;
      return el('tr', null,
        el('td', null, el('div', { class: 'sat-acc' }, el('span', { class: 'soc-plat', style: '--pc:' + (PLAT[a.platform] || ['', '#8893A8'])[1] }, (PLAT[a.platform] || [a.platform])[0]), link)),
        el('td', null, el('span', { class: 'pill ' + st[1] }, st[0])),
        el('td', { class: 'num', 'data-l': 'Follower' }, a.lastF != null ? num(a.lastF) : '—', a.gain ? el('small', { class: a.gain > 0 ? 'pos' : '' }, (a.gain > 0 ? '+' : '') + num(a.gain) + ' in 4 sett.') : null),
        el('td', { class: 'num', 'data-l': 'Views sett. scorsa' }, v != null ? v : a.status === 'attivo' ? el('span', { class: 'sat-miss' }, 'da segnare') : '—', vd != null ? el('small', { class: vd > 0 ? 'pos' : '' }, (vd > 0 ? '+' : '') + vd + '%') : null),
        el('td', { class: 'num hide-m', 'data-l': 'Post' }, po != null ? po : '—'),
        el('td', { class: 'hide-l' }, spark(weeksBack.map((w) => (a.nums[w] && a.nums[w].v != null ? a.nums[w].v : null)), colorOf(a.app))),
        el('td', { class: 'sat-actd' }, el('div', { class: 'sat-acts' },
          a.editable ? el('button', { class: 'btn', type: 'button', onclick: () => weekModal([a.id]) }, 'Numeri') : null,
          D.can_access ? el('button', { class: 'btn', type: 'button', title: a.has_secret ? 'Password salvata' : 'Nessuna password salvata', onclick: () => accessModal(a) }, ic(LOCK), 'Accesso') : null,
          a.editable ? el('button', { class: 'iconbtn', type: 'button', title: 'Modifica l\'account', 'aria-label': 'Modifica @' + a.handle, style: 'margin-left:0', onclick: () => accountModal(a, p) }, '⋯') : null)));
    });
    return el('div', { class: 'sat-page' }, head_, el('div', { style: 'overflow-x:auto' }, el('table', { class: 'sat-tbl' },
      el('thead', null, el('tr', null, el('th', null, 'Account'), el('th', null, 'Stato'), el('th', { class: 'num' }, 'Follower'), el('th', { class: 'num' }, 'Views sett. scorsa'),
        el('th', { class: 'num hide-m' }, 'Post'), el('th', { class: 'hide-l' }, 'Ultime 8 settimane'), el('th', null, ''))),
      el('tbody', null, ...rows))));
  }
  async function satReload(msg) { try { S.sat = await sql('sat', { weeks: S.satw || 12 }); S.st = null; S.err = null; if (msg) toast(msg); } catch (e) { toast(explain(e)); } if (S.view === 'satellite') render(); }

  function pageModal(p) {
    const D = S.sat, isNew = !p;
    p = p || { name: '', app: S.satf && S.satf !== 'all' && S.satf !== NO_APP.id ? S.satf : ((D.apps || [])[0] || {}).id || '', niche: '', manager: D.me, notes: '' };
    const name = inp({ value: p.name, maxlength: '60', placeholder: 'es. Soldi con l\'AI' });
    const app = el('select', { class: 'search' }, ...(D.apps || []).map((a) => el('option', { value: a.id, selected: p.app === a.id }, a.name)), el('option', { value: '', selected: !p.app }, 'Nessuna app'));
    const niche = inp({ value: p.niche || '', maxlength: '120', placeholder: 'es. tutorial su come guadagnare con l\'AI, NoonFrame tra gli strumenti' });
    const mgr = el('select', { class: 'search', disabled: !D.can_manage }, el('option', { value: '', selected: !p.manager }, 'Nessuno'), ...(D.members || []).map((m) => el('option', { value: m.email, selected: p.manager === m.email }, m.name || m.email)));
    const notes = el('textarea', { class: 'note', maxlength: '1000', placeholder: 'Facoltative: linee guida, orari, chi registra i video…' }, p.notes || '');
    stModal(isNew ? 'Nuova pagina satellite' : 'Modifica ' + p.name, [
      el('div', { class: 'st-fields' }, fld('Nome della pagina', name), fld('Quale app spinge', app)),
      fld('Di cosa parla', niche), fld('Chi la gestisce', mgr, 'Chi la gestisce può aggiungere i suoi account e segnare i numeri anche senza permessi speciali'), fld('Note', notes),
    ], (close) => [
      !isNew && D.can_manage ? btnArm('Togli la pagina', 'Conferma: tolgo anche account e password', async () => {
        await sql('sat_save', { op: 'page_remove', id: p.id, title: p.name }); close(); satReload('Pagina tolta');
      }) : null,
      el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
      el('button', { class: 'btn primary', type: 'button', onclick: async (e) => { const bt = e.currentTarget;
        if (!name.value.trim()) { toast('Scrivi il nome della pagina'); name.focus(); return; }
        bt.disabled = true;
        try {
          await sql('sat_save', { op: 'page', id: isNew ? null : p.id, name: name.value.trim(), app: app.value, niche: niche.value.trim(), manager: mgr.value, notes: notes.value.trim() });
          close(); satReload(isNew ? 'Pagina aggiunta: ora aggiungi i suoi account' : 'Pagina salvata');
        } catch (er) { toast(explain(er)); bt.disabled = false; }
      } }, isNew ? 'Aggiungi' : 'Salva'),
    ], 'narrow');
    name.focus();
  }

  function accountModal(a, page) {
    const D = S.sat, isNew = !a;
    const M = satModel(D);
    a = a || { platform: 'tiktok', handle: '', url: '', status: 'attivo', page_id: page.id };
    const pages = (D.pages || []).filter((p) => M.canEditPage(p));
    const pg = el('select', { class: 'search', disabled: !D.can_manage && !isNew }, ...pages.map((p) => el('option', { value: p.id, selected: p.id === a.page_id }, p.name + ' — ' + nameOf(p.app || NO_APP.id))));
    const plat = el('select', { class: 'search' }, ...Object.entries(PLAT).map(([k, [l]]) => el('option', { value: k, selected: a.platform === k }, l)));
    const handle = inp({ value: a.handle, maxlength: '60', placeholder: 'nomeprofilo' });
    const url = inp({ type: 'url', value: a.url || '', maxlength: '300', placeholder: 'https://www.tiktok.com/@nomeprofilo' });
    const status = el('select', { class: 'search' }, ...Object.entries(STATUS).map(([k, [l]]) => el('option', { value: k, selected: a.status === k }, l)));
    const autoUrl = () => { const h = handle.value.trim().replace(/^@/, ''); if (!h || (url.value && !url.dataset.auto)) return;
      const base = { tiktok: 'https://www.tiktok.com/@', instagram: 'https://www.instagram.com/', youtube: 'https://www.youtube.com/@', x: 'https://x.com/', threads: 'https://www.threads.net/@', twitch: 'https://www.twitch.tv/', pinterest: 'https://www.pinterest.com/', facebook: 'https://www.facebook.com/' }[plat.value];
      if (base && /^[A-Za-z0-9._-]+$/.test(h)) { url.value = base + h; url.dataset.auto = '1'; } };
    handle.addEventListener('input', autoUrl); plat.addEventListener('change', () => { if (url.dataset.auto) url.value = ''; autoUrl(); });
    url.addEventListener('input', () => { delete url.dataset.auto; });
    const kids = [el('div', { class: 'st-fields' }, fld('Pagina', pg), fld('Piattaforma', plat), fld('Nome profilo', handle, 'Senza la @'), fld('Stato', status)), fld('Link al profilo', url, 'Si compila da solo dal nome, puoi cambiarlo')];
    let em, ph, pw, nt;
    if (D.can_access) {
      em = inp({ value: a.login_email || '', maxlength: '200', autocomplete: 'off', placeholder: 'email o nome utente per entrare' });
      ph = inp({ value: a.login_phone || '', maxlength: '40', autocomplete: 'off', inputmode: 'tel', placeholder: '+39 …' });
      kids.push(el('div', { class: 'box', style: 'margin:0;display:grid;gap:10px' }, el('h3', { style: 'margin:0' }, 'Dati di accesso'),
        el('div', { class: 'st-fields' }, fld('Email o nome utente', em), fld('Telefono collegato', ph))));
      if (isNew) {
        pw = inp({ type: 'password', autocomplete: 'new-password', maxlength: '200', placeholder: 'Facoltativa' });
        nt = el('textarea', { class: 'note', maxlength: '2000', placeholder: 'Codici di recupero, domanda di sicurezza… (cifrate anche queste)', style: 'min-height:56px' });
        const eye = el('button', { class: 'btn sm', type: 'button', onclick: () => { pw.type = pw.type === 'password' ? 'text' : 'password'; eye.textContent = pw.type === 'password' ? 'Mostra' : 'Nascondi'; } }, 'Mostra');
        kids[kids.length - 1].append(fld('Password', el('div', { class: 'sat-pw' }, pw, eye)), fld('Note riservate', nt, 'Password e note vengono cifrate. Si rivedono da "Accesso", e ogni apertura resta nel registro.'));
      } else {
        kids[kids.length - 1].append(el('div', { class: 'row' }, el('button', { class: 'btn sm', type: 'button', onclick: () => accessModal(a) }, ic(LOCK), 'Password e note'), el('span', { class: 'muted', style: 'font-size:12px' }, a.has_secret ? 'Password salvata ' + when(a.secret_at) : 'Nessuna password salvata')));
      }
    }
    stModal(isNew ? 'Nuovo account in ' + page.name : PLAT[a.platform] ? (PLAT[a.platform][0] + ' @' + a.handle) : 'Account', kids, (close) => [
      !isNew && D.can_manage ? btnArm('Togli l\'account', 'Conferma: tolgo anche la password', async () => {
        await sql('sat_save', { op: 'account_remove', id: a.id, title: (PLAT[a.platform] || [a.platform])[0] + ' @' + a.handle }); close(); satReload('Account tolto');
      }) : null,
      el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
      el('button', { class: 'btn primary', type: 'button', onclick: async (e) => { const bt = e.currentTarget;
        const h = handle.value.trim().replace(/^@/, '');
        if (!h) { toast('Scrivi il nome del profilo'); handle.focus(); return; }
        const arg = { op: 'account', id: isNew ? null : a.id, page_id: pg.value, platform: plat.value, handle: h, url: url.value.trim(), status: status.value };
        if (D.can_access) { arg.login_email = em.value.trim(); arg.login_phone = ph.value.trim(); }
        bt.disabled = true;
        try {
          const r = await sql('sat_save', arg);
          if (isNew && D.can_access && ((pw && pw.value) || (nt && nt.value.trim()))) {
            await sql('sat_secret', { op: 'set', id: r.id, password: pw.value, notes: nt.value, title: (PLAT[r.platform] || [r.platform])[0] + ' @' + r.handle });
          }
          close(); satReload(isNew ? 'Account aggiunto' : 'Account salvato');
        } catch (er) { toast(explain(er)); bt.disabled = false; }
      } }, isNew ? 'Aggiungi' : 'Salva'),
    ], 'narrow');
    handle.focus();
  }

  // accessi: si leggono dal server solo quando apri la finestra (resta nel registro), mai tenuti nel pannello
  function accessModal(a) {
    const title = (PLAT[a.platform] || [a.platform])[0] + ' @' + a.handle;
    const box = el('div', { class: 'sat-secret' }, el('div', { class: 'loading', style: 'padding:20px' }, 'Apro l\'accesso…'));
    let sec = null, editing = false, close;
    const row = (label, value, opts = {}) => {
      const code = el('code', { class: value ? '' : 'ph' }, value ? (opts.mask ? '••••••••••' : value) : 'non salvato');
      let shown = !opts.mask;
      const acts = el('div', { class: 'row' },
        value && opts.mask ? el('button', { class: 'btn', type: 'button', onclick: (e) => { shown = !shown; code.textContent = shown ? value : '••••••••••'; e.currentTarget.textContent = shown ? 'Nascondi' : 'Mostra'; } }, 'Mostra') : null,
        value ? el('button', { class: 'btn', type: 'button', onclick: () => copy(value, label + ' copiata') }, 'Copia') : null);
      return el('div', { class: 'sat-sec-r' }, el('span', null, label), code, acts);
    };
    const paint = () => {
      if (!sec) return;
      if (!editing) {
        rc(box, row('Email o utente', sec.login_email), row('Telefono', sec.login_phone), row('Password', sec.password, { mask: true }),
          sec.notes ? el('div', { class: 'sat-sec-r' }, el('span', null, 'Note riservate'), el('code', { class: 'sat-sec-n' }, sec.notes), el('span')) : null,
          el('div', { class: 'sat-audit' }, ic(LOCK), el('span', null, (sec.secret_at ? 'Password aggiornata ' + when(sec.secret_at) + (sec.secret_by ? ' da ' + memberName(sec.secret_by, S.sat && S.sat.members) : '') + '. ' : '') + 'Hai aperto questo accesso adesso: resta scritto nel registro del team.')));
        return;
      }
      const em = inp({ value: sec.login_email || '', maxlength: '200', autocomplete: 'off' });
      const ph = inp({ value: sec.login_phone || '', maxlength: '40', autocomplete: 'off', inputmode: 'tel' });
      const pw = inp({ type: 'password', value: sec.password || '', maxlength: '200', autocomplete: 'new-password' });
      const eye = el('button', { class: 'btn sm', type: 'button', onclick: () => { pw.type = pw.type === 'password' ? 'text' : 'password'; eye.textContent = pw.type === 'password' ? 'Mostra' : 'Nascondi'; } }, 'Mostra');
      const nt = el('textarea', { class: 'note', maxlength: '2000', style: 'min-height:70px' }, sec.notes || '');
      rc(box, el('div', { class: 'st-fields' }, fld('Email o nome utente', em), fld('Telefono collegato', ph)), fld('Password', el('div', { class: 'sat-pw' }, pw, eye), 'Lascia vuoto per toglierla'), fld('Note riservate', nt),
        el('div', { class: 'row', style: 'justify-content:flex-end' }, el('button', { class: 'btn', type: 'button', onclick: () => { editing = false; paint(); } }, 'Annulla'),
          el('button', { class: 'btn primary', type: 'button', onclick: async (e) => { const bt = e.currentTarget;
            bt.disabled = true;
            try {
              const r = await sql('sat_secret', { op: 'set', id: a.id, login_email: em.value.trim(), login_phone: ph.value.trim(), password: pw.value, notes: nt.value, title });
              sec = { ...sec, login_email: r.login_email, login_phone: r.login_phone, password: pw.value || null, notes: nt.value.trim() || null, secret_at: r.secret_at, secret_by: ME && ME.email };
              Object.assign(a, { login_email: r.login_email, login_phone: r.login_phone, has_secret: r.has_secret, secret_at: r.secret_at });
              const sa = S.sat && (S.sat.accounts || []).find((x) => x.id === a.id); if (sa) Object.assign(sa, { login_email: r.login_email, login_phone: r.login_phone, has_secret: r.has_secret, secret_at: r.secret_at });
              editing = false; paint(); toast('Accesso salvato');
            } catch (er) { toast(explain(er)); bt.disabled = false; }
          } }, 'Salva l\'accesso')));
      em.focus();
    };
    close = stModal('Accesso · ' + title, [box], (cl) => [
      el('button', { class: 'btn', type: 'button', onclick: () => { if (sec) { editing = true; paint(); } } }, 'Modifica'),
      el('button', { class: 'btn primary', type: 'button', onclick: () => { sec = null; cl(); } }, 'Chiudi'),
    ], 'narrow');
    sql('sat_secret', { op: 'get', id: a.id, title }).then((r) => { sec = r; paint(); }, (e) => { rc(box, el('div', { class: 'err', style: 'margin:0' }, explain(e))); });
    return close;
  }

  // numeri della settimana: una riga per account, si salvano tutti insieme
  function weekModal(onlyIds) {
    const D = S.sat; const M = satModel(D);
    const list = M.accs.filter((a) => a.editable && (!onlyIds || onlyIds.includes(a.id)) && (onlyIds || a.status !== 'chiuso'))
      .sort((x, y) => String(nameOf(x.app)).localeCompare(nameOf(y.app)) || String(x.page && x.page.name).localeCompare(y.page && y.page.name));
    if (!list.length) { toast('Non ci sono account che puoi aggiornare'); return; }
    const opts = []; for (let i = 0; i <= 8; i++) { const w = addDays(D.week, -7 * i); opts.push([w, 'Settimana ' + wkLabel(w) + (i === 0 ? ' (in corso)' : i === 1 ? ' (la scorsa)' : '')]); }
    const wsel = el('select', { class: 'search', style: 'width:auto;max-width:100%' }, ...opts.map(([w, l]) => el('option', { value: w, selected: w === M.lastW }, l)));
    const tbody = el('tbody');
    const cells = [];
    const fill = () => {
      const w = wsel.value; cells.length = 0;
      rc(tbody, ...list.map((a) => {
        const cur = a.nums[w] || {}; const prevW = Object.keys(a.nums).filter((x) => x < w && a.nums[x].f != null).sort().pop();
        const row = { a, inputs: {} };
        const tds = WK_M.map(([k, l]) => { const i = inp({ inputmode: 'numeric', value: inVal(cur[k], false), 'aria-label': l + ' di @' + a.handle, placeholder: '—' }); row.inputs[k] = i; return el('td', null, i); });
        cells.push(row);
        return el('tr', null, el('td', null, el('div', { class: 'sat-acc' }, el('span', { class: 'soc-plat', style: '--pc:' + (PLAT[a.platform] || ['', '#8893A8'])[1] }, (PLAT[a.platform] || [a.platform])[0]), el('span', { class: 'h', style: 'font-weight:600' }, '@' + a.handle)),
          el('small', null, (a.page ? a.page.name : '') + (prevW ? ' · prima: ' + num(a.nums[prevW].f) + ' follower' : ''))), ...tds);
      }));
    };
    fill();
    let dirty = false, curW = wsel.value;
    tbody.addEventListener('input', () => { dirty = true; });
    wsel.addEventListener('change', () => {
      if (dirty && !confirm('Cambi settimana? I numeri scritti e non salvati si perdono.')) { wsel.value = curW; return; }
      dirty = false; curW = wsel.value; fill();
    });
    stModal('Numeri della settimana', [
      wsel,
      el('p', { class: 'muted', style: 'margin:0;font-size:13px' }, 'Prendili dalle statistiche di ogni app (ultimi 7 giorni). Follower: quanti ne ha adesso. Puoi scrivere "12.500" o "12,5k". Una riga vuota non cambia niente; cancellando i numeri di una riga, la settimana di quell\'account si svuota.'),
      el('div', { class: 'sat-wkwrap' }, el('table', { class: 'sat-wk' }, el('thead', null, el('tr', null, el('th', null, 'Account'), ...WK_M.map(([, l]) => el('th', null, l)))), tbody)),
    ], (close) => [
      el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
      el('button', { class: 'btn primary', type: 'button', onclick: async (e) => { const bt = e.currentTarget;
        const w = wsel.value; const rows = []; let bad = false;
        cells.forEach(({ a, inputs }) => {
          const cur = a.nums[w] || {}; const out = { account_id: a.id }; let changed = false;
          WK_M.forEach(([k]) => {
            const r = parseN(inputs[k].value, false); inputs[k].classList.toggle('bad', !r.ok);
            if (!r.ok) { bad = true; return; }
            out[{ v: 'views', f: 'followers', p: 'posts', i: 'interactions' }[k]] = r.v == null ? '' : String(r.v);
            if ((r.v == null ? null : r.v) !== (cur[k] == null ? null : +cur[k])) changed = true;
          });
          if (changed) rows.push(out);
        });
        if (bad) { toast('Controlla i numeri segnati in rosso'); return; }
        if (!rows.length) { toast('Nessun numero cambiato'); return; }
        bt.disabled = true;
        try { await sql('sat_save', { op: 'week', week: w, rows }); close(); satReload(rows.length === 1 ? 'Numeri salvati' : 'Numeri di ' + rows.length + ' account salvati'); }
        catch (er) { toast(explain(er)); bt.disabled = false; }
      } }, 'Salva i numeri'),
    ]);
    const first = cells[0] && cells[0].inputs.f; if (first) first.focus();
  }

  // ---------------------------------------------------------------- registrazione delle sezioni
  EXT.push({
    match: (v) => v === 'home', allowed: () => true,
    load: async (v, force) => { if (force || !S.st) S.st = await sql('studio'); },
    render: renderHome,
    onEnter: () => { setupFold(); navApps(true); },
    onGo: (v) => { openGroupOf(v); markCurrent(); },
  });
  EXT.push({
    match: (v) => v.startsWith('app:'), allowed: () => CAN('launch'),
    load: async (v, force) => {
      const id = v.slice(4);
      if (force || !S.appd[id]) S.appd[id] = await sql('app', { id });
      if (S.appd[id] && S.appd[id].app && S.appd[id].app.source === 'interno' && (force || !S.st)) S.st = await sql('studio');
    },
    render: renderApp,
  });
  EXT.push({
    match: (v) => v === 'satellite', allowed: () => true,
    load: async (v, force) => { if (force || !S.sat) S.sat = await sql('sat', { weeks: S.satw || 12 }); },
    render: renderSat,
  });
})();
