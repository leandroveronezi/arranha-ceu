'use strict';
// Invariantes sobre o catálogo inteiro (FAC): tudo o que a interface avisa como problema (sem acesso, em obras, fechada)
// precisa ter efeito 0 na simulação. Cada tipo de sala é montado numa torre mínima e medido por serviceNear, dayCtx().open,
// income() e alerts(). O que não dá para montar é pulado e listado no fim.
const {mk, put, ok, done, FAC, Game, UTIL} = require('./helpers');

const pulados = [];      // [k, motivo]
// o alcance da energia e da água tem testes próprios (utilidades.test.js, rede.test.js): aqui só o acesso
UTIL.reach.grid = 1e6; UTIL.reach.own = 1e6;
const cobertos = new Set();
const semAcessoPossivel = [];

// isentos de acesso pela regra do jogo (`NO_ACCESS` em data.js: saguão, ruína, transporte público e rampa; mais corredores/túneis, flag corr)
const isento = k => ['lobby', 'ruin', 'transit', 'busstop', 'taxi', 'parkramp'].includes(k) || !!FAC[k].corr || !!FAC[k].util;   // utilidades (gerador, bomba, bateria, caixa...) são infraestrutura: funcionam sem escada

// monta torre: saguão 0..63 no térreo; subject num andar adequado (acima, subsolo, térreo ou alto da torre); vizinho 'office' ao lado
function montar(k, comEscada) {
  const d = FAC[k];
  const g = mk(64); g.star = 5; g.msg = () => {}; g.updPerson = () => {};
  let L = 1;
  if (d.underOnly || (d.under && !d.above)) L = -d.h;
  else if (d.maxL === 0) L = 0;
  else if (k === 'landmark') L = 31;
  const sx = L === 0 ? 72 : d.w >= 64 ? 64 : 16, nx = L === 0 ? 64 : 0;
  const sxStairs = d.w >= 64 ? 56 : Math.max(56, Math.ceil((16 + d.w + 4) / 4) * 4);
  const lv = L > 0 ? Array.from({length: L}, (_, i) => i + 1) : L < 0 ? Array.from({length: -L}, (_, i) => -1 - i) : [];
  for (const l of lv) { const r = g.placeFloorSpan(l, 0, 127); if (!r.ok) return {err: 'piso ' + l + ': ' + r.err}; }
  let nb;
  try { nb = put(g, k === 'office' ? 'officeEx' : 'office', L, nx); } catch (e) { return {err: 'vizinho: ' + e.message}; }
  let f;
  try { f = put(g, k, L, sx, d.slope ? {dir: 1} : undefined); } catch (e) { return {err: e.message}; }
  if (d.park) { try { put(g, 'tunnelPortal', L, sx + d.w); } catch (e) { return {err: 'portal: ' + e.message}; } }   // a vaga só funciona ligada à entrada dos carros
  if (comEscada && L !== 0) {
    const niveis = L > 0 ? Array.from({length: L}, (_, i) => i) : Array.from({length: -L}, (_, i) => -1 - i);
    for (const l of niveis) { const r = g.placeStairs('stairs', l, sxStairs); if (!r.ok) return {err: 'escada ' + l + ': ' + r.err}; }
    g.stairs.forEach(s => { s.build = 1; });
  }
  g.ver++; g._rc = {}; g._rs = {};
  return {g, f, nb, L};
}

// efeitos medidos na simulação
function efeitos(g, f, nb, hold) {
  g.ver++; g._rc = {}; g._rs = {};
  const svc = FAC[f.k].svc;
  const rec = []; const inc = g.income.bind(g); g.income = (c, a) => { rec.push([c, a]); inc(c, a); };
  if (FAC[f.k].tenant || FAC[f.k].commercial) { f.occ = true; f.persons = f.persons || []; }
  nb.occ = false;
  const seg = () => { if (hold !== undefined) f.build = hold; };
  try { seg(); g.quarter(); for (let d = 0; d < 2; d++) { seg(); g.newDay(); for (let i = 0; i < 40; i++) { seg(); g.step(1); } } seg(); } catch (e) { rec.push(['EXC', e.message]); }
  g.income = inc;
  const renda = rec.filter(r => r[0] === 'EXC' || (r[0] === f.k && r[1] > 0)).length;
  // utilidades: produção/reserva que a sala acrescenta à rede (energia, água)
  let util = 0;
  const u = FAC[f.k].util;
  if (u) {
    g.t = 12 * 60; g._utk = null; g.ver++;
    for (const res of ['energia', 'agua']) { util += Math.max(0, g.utilFlow(res) - UTIL.grid[res]); util += g.storeSpec(res).cap; }
  }
  return {
    util,
    vagas: g.countOk(f.k),
    serviceNear: svc && svc !== 'transporte' ? g.serviceNear(nb, svc) : 0,
    transporte: svc === 'transporte' ? g.transportTier() : 0,
    open: g.dayCtx().open.includes(f) ? 1 : 0,
    income: renda,
  };
}
const zero = e => e.util === 0 && e.vagas === 0 && e.serviceNear === 0 && e.transporte === 0 && e.open === 0 && e.income === 0;
const avisoUI = (g, f) => !g.reachable(f) && g.needsAccess(f);   // condição do aviso vermelho em ui.js
const temAlerta = (g, f) => g.alerts().some(a => a.title.startsWith('🚫 Sala sem acesso') && a.fac !== f && a.title.includes('(andar ' + (f.L < 0 ? 'B' + (-f.L) : f.L + 1) + ')') && a.title.includes(FAC[f.k].label));

const tipos = Object.keys(FAC);
for (const k of tipos) {
  const d = FAC[k];
  if (isento(k)) { pulados.push([k, 'isento de acesso pela regra (lobby/ruína/corredor/túnel)']); continue; }
  const m0 = montar(k, false);
  if (m0.err) { pulados.push([k, 'não montou: ' + m0.err]); continue; }
  cobertos.add(k);
  const {g, f, nb, L} = m0;

  // (1) sem acesso
  if (L === 0) {
    semAcessoPossivel.push(k);   // térreo: sempre acessível, não dá para tirar o acesso
    ok(g.reachable(f), k + ': no térreo a sala é sempre acessível');
  } else {
    ok(!g.reachable(f), k + ': sem escada/elevador não tem acesso');
    ok(!g.serves(f), k + ': sem acesso serves(f) é falso');
    const e = efeitos(g, f, nb);
    ok(zero(e), k + ': sem acesso todos os efeitos são 0 ' + JSON.stringify(e));
    ok(avisoUI(g, f) === !g.serves(f) || !f.build, k + ': aviso da UI (!reachable && needsAccess) bate com serves');
    ok(g.alerts().some(a => a.title.includes('Sala sem acesso') && a.title.includes(d.label)), k + ': alerts() avisa "Sala sem acesso"');
  }

  // (2) com acesso
  const m1 = montar(k, true);
  if (m1.err) pulados.push([k, 'com acesso não montou: ' + m1.err]);
  else {
    const {g: g1, f: f1, nb: nb1} = m1;
    ok(g1.reachable(f1) && g1.serves(f1), k + ': com acesso serves(f) é verdadeiro');
    ok(!avisoUI(g1, f1), k + ': com acesso não há aviso vermelho');
    if (d.svc && d.svc !== 'transporte') ok(g1.serviceNear(nb1, d.svc) > 0, k + ': com acesso serviceNear(' + d.svc + ') > 0');
    if (d.svc === 'transporte') ok(g1.transportTier() > 0, k + ': com acesso o transporte conta');
    { const ea = efeitos(g1, f1, nb1); ok(!zero(ea) || (!d.util && !d.svc && !d.biz && !d.commercial && !d.tenant && !d.hotel), k + ': com acesso os efeitos medidos aparecem ' + JSON.stringify(ea)); f1.build = 1; }
    if (d.biz || d.commercial || d.tenant) ok(g1.dayCtx().open.includes(f1), k + ': com acesso entra em dayCtx().open');

    // (3) em obras
    f1.build = 0.5; g1.ver++; g1._rc = {};
    const eo = efeitos(g1, f1, nb1, 0.5);
    ok(zero(eo) && !g1.serves(f1), k + ': em obras nenhum efeito ' + JSON.stringify(eo));
    f1.build = 1;

    // (4) fechada
    if (d.biz) {
      f1.closed = true; g1.ver++;
      const ec = efeitos(g1, f1, nb1);
      ok(zero(ec) && !g1.serves(f1), k + ': fechada nenhum efeito ' + JSON.stringify(ec));
    }
  }
}

console.log(`\ntipos no catálogo: ${tipos.length}; cobertos: ${cobertos.size}; pulados: ${pulados.length}`);
for (const [k, why] of pulados) console.log(`  pulado ${k}: ${why}`);
console.log('  só térreo (sem teste de "sem acesso"): ' + semAcessoPossivel.join(', '));
done('invariantes');
