const fs = require('fs');
const path = require('path');
const D = require('./data.js');
// Usa el Chromium de Playwright que ya trae el frontend (cd frontend && npm install).
const { chromium } = require(path.join(__dirname, '../../frontend/node_modules/@playwright/test'));

// Uso: node docs/cronograma/build.js [carpeta-de-salida]  (por defecto docs/)
// Para actualizar el cronograma edita data.js (tareas, semanas, estados) y vuelve a correrlo.

const OUT_DIR = process.argv[2] || path.join(__dirname, "..");
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const STATUS_LABEL = { hecho: 'Hecho', siguiente: 'Siguiente', pendiente: 'Pendiente' };

const css = `
@page { size: A4 landscape; }
:root { --navy:#0D2040; --sky:#2E86AB; --gold:#B38A3C; --green:#1F8A63; --red:#B3362B; --ink:#1B2B45; --mute:#5B6B82; --line:#DDE4EE; --tint:#F3F6FA; }
* { box-sizing: border-box; }
html, body { margin:0; padding:0; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: var(--ink); font-size: 9pt; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
h1,h2,h3,p { margin:0; }
h2 { font-size: 13pt; color: var(--navy); font-weight: 700; letter-spacing: -0.2px; }
.sub { color: var(--mute); font-size: 8.4pt; margin-top: 1mm; }
.band { background: var(--navy); color:#fff; border-radius: 2.5mm; padding: 6mm 8mm; display:flex; justify-content:space-between; align-items:flex-end; }
.band h1 { font-size: 21pt; letter-spacing: -0.4px; font-weight: 700; }
.band .k { font-size: 8pt; text-transform: uppercase; letter-spacing: 1.4px; color: #9CC3D6; margin-bottom: 1.5mm; }
.band .r { text-align:right; font-size: 8.6pt; color:#D6E4EE; line-height: 1.5; }
.band .r b { color:#fff; }
.kpis { display:grid; grid-template-columns: repeat(4,1fr); gap: 4mm; margin-top: 4mm; }
.kpi { border:1px solid var(--line); border-radius: 2mm; padding: 3mm 4mm; background:#fff; }
.kpi .n { font-size: 20pt; font-weight: 700; color: var(--navy); line-height: 1.05; }
.kpi .t { font-size: 8pt; color: var(--mute); margin-top: 1mm; }
.cols { display:grid; grid-template-columns: 1.55fr 1fr; gap: 6mm; margin-top: 5mm; }
.sec-t { font-size: 10pt; font-weight: 700; color: var(--navy); margin-bottom: 2mm; padding-bottom: 1.2mm; border-bottom: 1.5px solid var(--navy); display:flex; justify-content:space-between; align-items:baseline; }
.sec-t small { font-weight: 400; color: var(--mute); font-size: 7.6pt; }
table { border-collapse: collapse; width:100%; }
.cov td { padding: 1.35mm 1.4mm; border-bottom: 1px solid var(--line); font-size: 8pt; vertical-align: middle; }
.cov td.nm { font-weight: 600; color: var(--navy); }
.cov td.nt { color: var(--mute); }
.cov td.rf { color: var(--ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
.chip { display:inline-block; border-radius: 1.2mm; padding: 0.3mm 1.8mm; font-size: 7pt; font-weight: 700; color:#fff; white-space: nowrap; }
.chip.hecho { background: var(--green); } .chip.parcial { background: var(--gold); } .chip.falta { background: var(--red); }
.chip.siguiente { background: var(--gold); } .chip.pendiente { background: var(--sky); }
.ms { display:flex; gap: 2.5mm; align-items:flex-start; padding: 1.5mm 0; border-bottom: 1px solid var(--line); font-size: 8pt; }
.ms .cd { flex:none; width: 8mm; text-align:center; border-radius: 1.2mm; background: var(--navy); color:#fff; font-weight:700; font-size: 7.2pt; padding: 0.7mm 0; }
.ms .cd.done { background: var(--green); }
.ms .dt { flex:none; width: 11mm; font-weight:700; color: var(--navy); }
.ms .tx { color: var(--ink); }
.next li { margin-bottom: 1.2mm; }
ul { margin: 0; padding-left: 4.2mm; }
li { font-size: 8.2pt; }
.two li { font-size: 9pt; margin-bottom: 0.8mm; }
.two .grp2 h3 { font-size: 9.6pt; margin-bottom: 1.2mm; }
.call { margin-top: 4mm; border: 1px solid var(--gold); background: #FBF6EA; border-radius: 2mm; padding: 3mm 4mm; font-size: 8.2pt; }
.call b { color: #7C5B16; }

/* Gantt */
.gt { table-layout: fixed; font-size: 7.1pt; margin-top: 3mm; }
.gt th, .gt td { padding:0; }
.gt .hm { background: var(--navy); color:#fff; font-size: 7pt; font-weight:700; text-align:center; height: 4.4mm; border-left: 1px solid #1E3560; }
.gt .hs { background: #E7EEF6; color: var(--navy); font-size: 6.4pt; font-weight:700; text-align:center; height: 4mm; border-left: 1px solid #fff; }
.gt .hw { background: var(--tint); color: var(--navy); font-size: 6.8pt; font-weight:700; text-align:center; height: 4mm; border-left: 1px solid #fff; }
.gt .hd { background: var(--tint); color: var(--mute); font-size: 6.2pt; text-align:center; height: 3.6mm; border-left: 1px solid #fff; border-bottom: 1px solid var(--line); }
.gt .lbl { background: var(--tint); color: var(--mute); font-size: 6.4pt; font-weight:600; text-align:right; padding-right: 2mm; }
.gt .hm.lbl { background: var(--navy); }
.gt th.today { background: var(--gold); color:#fff; }
.gt th.next { background: var(--sky); color:#fff; }
.gt .grp td { background: #E7EEF6; color: var(--navy); font-weight:700; font-size: 7.4pt; height: 5mm; padding: 0 2mm; border-top: 1px solid #fff; }
.gt .grp .rg { font-weight:400; color: var(--mute); margin-left: 2mm; }
.gt .grp .nt { float:right; font-weight:600; color: var(--navy); }
.gt tr.r td { height: 4.9mm; border-bottom: 1px solid #EEF2F7; }
.gt td.nm { padding-left: 1.5mm; white-space: nowrap; overflow:hidden; text-overflow: ellipsis; color: var(--ink); }
.gt td.nm .id { display:inline-block; width: 6.5mm; font-weight:700; color: var(--mute); }
.gt td.ow { text-align:center; color: var(--mute); font-size: 6.4pt; }
.gt td.w { position: relative; box-shadow: inset 1px 0 0 #E9EEF4; }
.gt td.w.sp { box-shadow: inset 1px 0 0 #CBD5E2; }
.gt td.w.today { background-color: rgba(179,138,60,0.13); }
.gt td.w.next { background-color: rgba(46,134,171,0.08); }
.gt .b { height: 3.2mm; margin: 0.8mm 0; }
.gt .b.hecho { background: var(--green); } .gt .b.siguiente { background: var(--gold); } .gt .b.pendiente { background: var(--sky); }
.gt .b:not(.s) { margin-left: -1px; }
.gt .b.s { border-top-left-radius: 1.6mm; border-bottom-left-radius: 1.6mm; margin-left: 0.6mm; }
.gt .b.e { border-top-right-radius: 1.6mm; border-bottom-right-radius: 1.6mm; margin-right: 0.6mm; }
.gt .dec { display:inline-block; margin-left: 1.5mm; background: var(--red); color:#fff; border-radius: 1mm; font-size: 5.6pt; font-weight:700; padding: 0 1mm; vertical-align: 0.3px; }
.gt tr.mrow td { height: 6.5mm; background: #FBFCFD; border-bottom: 1px solid var(--line); }
.gt tr.mrow td.nm { font-weight:700; color: var(--navy); }
.mk { display:block; margin: 0 auto; width: 6.4mm; text-align:center; background: var(--navy); color:#fff; border-radius: 1.2mm; font-size: 6.4pt; font-weight:700; line-height: 4.2mm; height: 4.2mm; }
.mk.done { background: var(--green); } .mk.gl { background: var(--gold); }
.legend { display:flex; flex-wrap: wrap; gap: 1.5mm 5mm; margin-top: 3mm; font-size: 7.2pt; color: var(--mute); align-items:center; }
.legend .sw { display:inline-block; width: 7mm; height: 2.8mm; border-radius: 1.4mm; vertical-align: middle; margin-right: 1.2mm; }
.mslist { margin-top: 2.5mm; display:grid; grid-template-columns: 1fr 1fr; gap: 0 6mm; font-size: 7.2pt; color: var(--ink); }
.mslist div { padding: 0.7mm 0; border-bottom: 1px solid #EEF2F7; }
.mslist b { color: var(--navy); }

/* Detalle */
.dt { font-size: 7.5pt; }
.dt th { background: var(--navy); color:#fff; text-align:left; font-weight:600; padding: 1.4mm 1.8mm; font-size: 7.2pt; }
.dt td { padding: 1.3mm 1.8mm; border-bottom: 1px solid var(--line); vertical-align: top; }
.dt tr { break-inside: avoid; page-break-inside: avoid; }
.dt td.id { font-weight:700; color: var(--mute); white-space: nowrap; }
.dt td.nm { font-weight:600; color: var(--navy); }
.dt td.wk { white-space: nowrap; font-variant-numeric: tabular-nums; }
.dt td.wk small { display:block; color: var(--mute); font-size: 6.6pt; }
.dt .dec { background: var(--red); color:#fff; border-radius: 1mm; font-size: 6pt; font-weight:700; padding: 0 1.2mm; margin-left: 1.5mm; }
.ph { margin: 5mm 0 1.5mm; font-size: 10pt; font-weight:700; color: var(--navy); display:flex; justify-content:space-between; align-items: baseline; break-after: avoid; page-break-after: avoid; }
.ph small { font-weight:400; color: var(--mute); font-size: 7.6pt; }
.ph:first-child { margin-top: 0; }

/* Listas dos columnas */
.two { display:grid; grid-template-columns: 1fr 1fr; gap: 7mm; margin-top: 4mm; }
.grp2 { margin-bottom: 3.2mm; break-inside: avoid; }
.grp2 h3 { font-size: 8.6pt; color: var(--navy); margin-bottom: 0.8mm; }
.ok h3:before { content:''; display:inline-block; width:2.4mm; height:2.4mm; border-radius:50%; background: var(--green); margin-right: 1.6mm; vertical-align: 0; }
.no h3:before { content:''; display:inline-block; width:2.4mm; height:2.4mm; border-radius:50%; background: var(--red); margin-right: 1.6mm; }
.colh { font-size: 11pt; font-weight:700; color: var(--navy); padding-bottom: 1.2mm; border-bottom: 1.5px solid var(--navy); margin-bottom: 3mm; }

/* Riesgos / decisiones */
.rt th { background: var(--navy); color:#fff; text-align:left; font-weight:600; padding: 1.4mm 2mm; font-size: 7.4pt; }
.rt td { padding: 1.6mm 2mm; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 7.8pt; }
.rt td.nm { font-weight:700; color: var(--navy); width: 42mm; }
.rt td.dl { white-space: nowrap; font-weight:700; color: #7C5B16; width: 26mm; }

/* Horizonte */
.hz { display:grid; grid-template-columns: repeat(3,1fr); gap: 4mm; margin-top: 4mm; }
.hz .c { border:1px solid var(--line); border-top: 3px solid var(--sky); border-radius: 0 0 2mm 2mm; padding: 3.5mm 4mm; background:#fff; }
.hz .c.g1 { border-top-color: var(--gold); } .hz .c.g2 { border-top-color: var(--sky); } .hz .c.g3 { border-top-color: var(--navy); }
.hz .rg { font-size: 7.6pt; color: var(--mute); font-weight:600; text-transform: uppercase; letter-spacing: 0.6px; }
.hz h3 { font-size: 11pt; color: var(--navy); margin: 1mm 0 2mm; }
.gate { margin-top: 5mm; border: 1.5px dashed var(--gold); background:#FBF6EA; border-radius: 2mm; padding: 4mm 5mm; }
.gate h3 { font-size: 10pt; color:#7C5B16; margin-bottom: 1.2mm; }
.gate p, .gate li { font-size: 8.2pt; }
.note { font-size: 7.4pt; color: var(--mute); margin-top: 3mm; }
.logros { margin: 0; padding-left: 4.4mm; }
.logros li { font-size: 8.6pt; margin-bottom: 1.6mm; }
.logros .ref { color: var(--mute); font-size: 7.2pt; margin-left: 1mm; white-space: nowrap; }
.logros .ref:before { content: '· '; }
`;

function ganttHeader() {
  let h = '<thead>';
  h += '<tr><th class="hm lbl" style="text-align:left;padding-left:2mm">Mes</th><th class="hm lbl"></th>';
  for (const [m, n] of D.MONTHS_HEADER) h += `<th class="hm" colspan="${n}">${m}</th>`;
  h += '</tr>';
  h += '<tr><th class="hs lbl">Sprint del Plan Maestro</th><th class="hs"></th>';
  for (let s = 1; s <= 12; s++) h += `<th class="hs" colspan="2">Sprint ${s}</th>`;
  h += '<th class="hs">Live</th></tr>';
  h += '<tr><th class="hw lbl">Semana</th><th class="hw"></th>';
  for (let w = 1; w <= D.TOTAL_WEEKS; w++) h += `<th class="hw${w === D.TODAY_WEEK ? ' today' : w === D.NEXT_WEEK ? ' next' : ''}">${w}</th>`;
  h += '</tr>';
  h += '<tr><th class="hd lbl">Lunes de la semana</th><th class="hd">Resp.</th>';
  for (let w = 1; w <= D.TOTAL_WEEKS; w++) h += `<th class="hd${w === D.TODAY_WEEK ? ' today' : w === D.NEXT_WEEK ? ' next' : ''}">${D.weekStart(w).getUTCDate()}</th>`;
  h += '</tr></thead>';
  return h;
}

function cells(t) {
  let c = '';
  for (let w = 1; w <= D.TOTAL_WEEKS; w++) {
    const inRange = w >= t.s && w <= t.e;
    const cls = ['w', w % 2 === 1 ? 'sp' : '', w === D.TODAY_WEEK ? 'today' : w === D.NEXT_WEEK ? 'next' : ''].filter(Boolean).join(' ');
    const bar = inRange ? `<div class="b ${t.st}${w === t.s ? ' s' : ''}${w === t.e ? ' e' : ''}"></div>` : '';
    c += `<td class="${cls}">${bar}</td>`;
  }
  return c;
}

function milestoneRow() {
  let c = '<tr class="mrow"><td class="nm" style="padding-left:1.5mm">Hitos</td><td></td>';
  for (let w = 1; w <= D.TOTAL_WEEKS; w++) {
    const m = D.MILESTONES.find((x) => x.w === w);
    const cls = ['w', w % 2 === 1 ? 'sp' : '', w === D.TODAY_WEEK ? 'today' : w === D.NEXT_WEEK ? 'next' : ''].filter(Boolean).join(' ');
    c += `<td class="${cls}">${m ? `<span class="mk${m.done ? ' done' : ''}${m.code === 'GL' ? ' gl' : ''}">${m.code}</span>` : ''}</td>`;
  }
  return c + '</tr>';
}

function ganttTable(phaseKeys) {
  let h = `<table class="gt"><colgroup><col style="width:79mm"><col style="width:11mm">${'<col>'.repeat(D.TOTAL_WEEKS)}</colgroup>`;
  h += ganttHeader() + '<tbody>' + milestoneRow();
  for (const p of D.PHASES.filter((x) => phaseKeys.includes(x.key))) {
    h += `<tr class="grp"><td colspan="${D.TOTAL_WEEKS + 2}">${esc(p.name)}<span class="rg">${esc(p.range)}</span><span class="nt">${esc(p.note)}</span></td></tr>`;
    for (const t of p.tasks.slice().sort((a, b) => a.s - b.s)) {
      h += `<tr class="r"><td class="nm"><span class="id">${t.id}</span>${esc(t.name)}${t.decision ? '<span class="dec">DECISIÓN</span>' : ''}</td><td class="ow">${t.owner}</td>${cells(t)}</tr>`;
    }
  }
  return h + '</tbody></table>';
}

function legend() {
  return `<div class="legend">
    <span><span class="sw" style="background:var(--green)"></span>Hecho</span>
    <span><span class="sw" style="background:var(--gold)"></span>Siguiente</span>
    <span><span class="sw" style="background:var(--sky)"></span>Pendiente</span>
    <span><span class="sw" style="background:rgba(179,138,60,.25);border:1px solid var(--gold)"></span>Hoy · 6 nov, semana 5</span>
    <span><span class="sw" style="background:rgba(46,134,171,.2);border:1px solid var(--sky)"></span>Próxima semana (9–13 nov)</span>
    <span><span class="dec" style="background:var(--red);color:#fff;border-radius:1mm;font-size:5.6pt;font-weight:700;padding:0 1mm">DECISIÓN</span> la tarea espera una decisión de Kevin</span>
    <span>Resp.: Kevin · Dev (desarrollador de apoyo) · Ambos</span>
  </div>`;
}

function milestoneList() {
  return `<div class="mslist">${D.MILESTONES.map((m) => `<div><b>${m.code} · ${m.date}</b> — ${esc(m.text)}</div>`).join('')}</div>`;
}

function detailTable(p) {
  let h = `<div class="ph"><span>${esc(p.name)}</span><small>${esc(p.range)} · ${esc(p.note)}</small></div>`;
  h += `<table class="dt"><colgroup><col style="width:9mm"><col style="width:52mm"><col style="width:110mm"><col style="width:28mm"><col style="width:13mm"><col style="width:29mm"><col style="width:22mm"></colgroup>`;
  h += '<thead><tr><th>ID</th><th>Tarea</th><th>Qué incluye</th><th>Semanas</th><th>Resp.</th><th>Depende de</th><th>Estado</th></tr></thead><tbody>';
  for (const t of p.tasks.slice().sort((a, b) => a.s - b.s)) {
    h += `<tr><td class="id">${t.id}</td><td class="nm">${esc(t.name)}${t.decision ? '<span class="dec">DECISIÓN</span>' : ''}</td><td>${esc(t.what)}</td>`;
    h += `<td class="wk">${D.semanas(t.s, t.e)}<small>${D.fechas(t.s, t.e)}</small></td><td>${t.owner}</td><td>${esc(t.dep)}</td>`;
    h += `<td><span class="chip ${t.st}">${STATUS_LABEL[t.st]}</span></td></tr>`;
  }
  return h + '</tbody></table>';
}

function groups(list, cls) {
  return list.map(([t, items]) => `<div class="grp2 ${cls}"><h3>${esc(t)}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('');
}

const chipFor = (s) => `<span class="chip ${s}">${{ hecho: 'Hecho', parcial: 'Parcial', falta: 'Falta' }[s]}</span>`;

const hechoCount = D.COVERAGE.filter((c) => c[1] === 'hecho').length;
const parcialCount = D.COVERAGE.filter((c) => c[1] === 'parcial').length;
const faltaCount = D.COVERAGE.filter((c) => c[1] === 'falta').length;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>SUTL — Cronograma y hoja de ruta</title><style>${css}</style></head><body>

<!-- 1. Resumen -->
<section class="page">
  <div class="band">
    <div><div class="k">SVK Solutions · SUTL</div><h1>Cronograma y hoja de ruta</h1>
      <div style="font-size:9.4pt;color:#D6E4EE;margin-top:1.5mm">Lo que ya tenemos, lo que falta y cuándo se construye</div></div>
    <div class="r"><b>Corte: 6 de noviembre de 2026</b> · fin de la semana 5 de 25<br>Meta: producción la semana del <b>22 de marzo de 2027</b><br>Documento interno · sin precios</div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="n">23</div><div class="t">módulos de backend funcionando contra Postgres y Mongo reales</div></div>
    <div class="kpi"><div class="n">201</div><div class="t">pruebas automáticas: 38 unitarias, 151 de punta a punta y 12 de navegador</div></div>
    <div class="kpi"><div class="n">21</div><div class="t">secciones del panel, más landing, login, tracking público y modo demo</div></div>
    <div class="kpi"><div class="n" style="color:var(--red)">Local</div><div class="t">único entorno activo; staging y producción siguen sin desplegarse</div></div>
  </div>
  <div class="cols">
    <div>
      <div class="sec-t"><span>Mapa de cobertura del Business Plan</span><small>${hechoCount} hechos · ${parcialCount} parciales · ${faltaCount} faltan</small></div>
      <table class="cov"><tbody>
        ${D.COVERAGE.map(([n, s, nt, rf]) => `<tr><td class="nm">${esc(n)}</td><td>${chipFor(s)}</td><td class="nt">${esc(nt)}</td><td class="rf">${esc(rf)}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div>
      <div class="sec-t"><span>Hitos</span><small>fechas del Plan Maestro v1.0</small></div>
      ${D.MILESTONES.map((m) => `<div class="ms"><span class="cd${m.done ? ' done' : ''}">${m.code}</span><span class="dt">${m.date}</span><span class="tx">${esc(m.text)}</span></div>`).join('')}
      <div class="call"><b>Lo urgente de la próxima semana (9–13 nov):</b>
        <ul style="margin-top:1mm">
          <li><b>Decidir dónde vive el staging</b> (D1): es la ruta crítica para hacer un piloto con un cliente real.</li>
          <li><b>Definir el canal de contacto</b> de la landing (A4).</li>
          <li>Activar la protección de ramas en GitHub (A2, 15 min).</li>
        </ul>Detalle en la página siguiente.</div>
    </div>
  </div>
</section>

<!-- 1b. Semana 5 y plan de la semana 6 -->
<section class="page">
  <h2>Semana 5 en revisión y plan de la semana 6</h2>
  <p class="sub">Lo que se cerró del 2 al 6 de noviembre, qué cambió en el cronograma y qué se hace del 9 al 13.</p>
  <div class="cols" style="grid-template-columns: 1fr 1.25fr; margin-top: 3mm">
    <div>
      <div class="sec-t"><span>Cerrado en la semana 5</span></div>
      <ul class="logros">
        ${D.LOGROS_SEMANA.map(([t, r]) => `<li>${esc(t)} <span class="ref">${esc(r)}</span></li>`).join('')}
      </ul>
      <div class="sec-t" style="margin-top:4mm"><span>Qué cambió en el cronograma</span></div>
      <ul class="logros">${D.CAMBIOS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>
    <div>
      <div class="sec-t"><span>Plan de la semana 6 · 9–13 nov</span><small>qué se da por hecho al terminar</small></div>
      <table class="rt"><thead><tr><th>Tarea</th><th>Resp.</th><th>Está hecha cuando</th></tr></thead><tbody>
        ${D.PLAN_SEMANA.map((t) => `<tr><td class="nm" style="width:46mm">${t.id} · ${esc(t.titulo)}${t.decision ? '<span class="dec" style="background:var(--red);color:#fff;border-radius:1mm;font-size:5.8pt;font-weight:700;padding:0 1.2mm;margin-left:1.5mm">DECISIÓN</span>' : ''}</td><td style="white-space:nowrap">${t.resp}</td><td>${esc(t.hecho)}<span style="display:block;color:var(--mute);font-size:7pt;margin-top:0.6mm">${esc(t.nota)}</span></td></tr>`).join('')}
      </tbody></table>
    </div>
  </div>
</section>

<!-- 2. Ya tenemos / falta -->
<section class="page">
  <h2>Lo que ya tenemos y lo que falta</h2>
  <p class="sub">Entre paréntesis, el ID de la tarea del cronograma que cubre cada pendiente.</p>
  <div class="two">
    <div><div class="colh">Ya funciona</div>${groups(D.YA_FUNCIONA, 'ok')}</div>
    <div><div class="colh">Todavía no existe</div>${groups(D.FALTA, 'no')}</div>
  </div>
</section>

<!-- 3. Gantt 1 -->
<section class="page">
  <h2>Cronograma por semanas · parte 1 de 2</h2>
  <p class="sub">Base ya construida, Fase A (MVP operable) y Fase B (Control Tower). La semana 1 empezó el 5 de octubre de 2026.</p>
  ${ganttTable(['base', 'A', 'B'])}
  ${legend()}
</section>

<!-- 4. Gantt 2 -->
<section class="page">
  <h2>Cronograma por semanas · parte 2 de 2</h2>
  <p class="sub">Fase C (portal, analítica y panel SaaS) y las fases paralelas de nube y comercial, hasta la salida a producción.</p>
  ${ganttTable(['C', 'D', 'E'])}
  ${legend()}
  <p class="note">Hitos H1 a GL: detalle en la primera página. Las semanas de lo ya terminado son aproximadas, según el historial. Las fechas de los hitos H2 a H5 son las del Plan Maestro; el contenido de cada hito se ajustó al giro del Business Plan 2026.</p>
</section>

<!-- 5. Detalle -->
<section class="page">
  <h2>Detalle de tareas</h2>
  <p class="sub">Qué incluye cada tarea, cuándo, quién la lleva y de qué depende.</p>
  ${['A', 'B', 'C', 'D', 'E'].map((k) => detailTable(D.PHASES.find((p) => p.key === k))).join('')}
</section>

<!-- 6. Riesgos y decisiones -->
<section class="page">
  <h2>Riesgos y decisiones pendientes</h2>
  <div class="sec-t" style="margin-top:4mm"><span>Decisiones que necesito de ti</span><small>con fecha límite para no mover el cronograma</small></div>
  <table class="rt"><thead><tr><th>Decisión</th><th>Detalle</th><th>Para cuándo</th></tr></thead><tbody>
    ${D.DECISIONES.map(([n, d, f]) => `<tr><td class="nm">${esc(n)}</td><td>${esc(d)}</td><td class="dl">${f}</td></tr>`).join('')}
  </tbody></table>
  <div class="sec-t" style="margin-top:6mm"><span>Riesgos y cómo los manejamos</span></div>
  <table class="rt"><thead><tr><th>Riesgo</th><th>Por qué importa</th><th>Qué hacemos</th></tr></thead><tbody>
    ${D.RIESGOS.map(([n, d, m]) => `<tr><td class="nm">${esc(n)}</td><td>${esc(d)}</td><td>${esc(m)}</td></tr>`).join('')}
  </tbody></table>
  <p class="note">Supuestos: equipo de dos personas (Kevin y un desarrollador de apoyo) trabajando con Claude Code; estimaciones de ±1 semana; las semanas 12 y 13 (Navidad y Año Nuevo) y la de Carnaval tienen capacidad reducida.</p>
</section>

<!-- 7. Horizonte -->
<section class="page">
  <h2>Después del go-live: horizonte</h2>
  <p class="sub">Direccional. Sigue los plazos de producto del Business Plan (6–12, 12–18 y 18–24 meses) y se reordena según lo que enseñe el piloto.</p>
  <div class="gate"><h3>Compuerta de validación (abril 2027)</h3>
    <p>El Business Plan pide convertir al menos un piloto en contrato anual antes de ampliar el desarrollo. Con ese resultado se decide cuánto invertir en lo que sigue.</p></div>
  <div class="hz">
    ${D.HORIZONTE.map((c, i) => `<div class="c g${i + 1}"><div class="rg">${esc(c.rango)}</div><h3>${esc(c.titulo)}</h3><ul>${c.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
  </div>
  <p class="note">El autoabastecimiento sigue siendo la última funcionalidad grande, como lo pediste el 26 de octubre.</p>
</section>

</body></html>`;

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const htmlPath = path.join(require('os').tmpdir(), 'sutl-cronograma.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'));
  const pdfPath = path.join(OUT_DIR, 'Cronograma_SUTL.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font-family:'Segoe UI',Arial,sans-serif;font-size:7px;color:#5B6B82;padding:0 12mm;display:flex;justify-content:space-between"><span>SUTL · SVK Solutions · Cronograma v1 · corte 6 nov 2026 · Documento interno</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: '10mm', bottom: '12mm', left: '12mm', right: '12mm' },
  });
  await browser.close();
  console.log('ok', pdfPath);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
