'use strict';
// Comércios e serviços (café, mercadinho, lavanderia, banco, academia, creche, restaurantes...) fecham e viram vagos se ficam sem movimento ou inseguros, e reabrem quando melhora.
const {FAC, BIZ, ok, done, mk: mk0, put, roundTrip} = require('./helpers');
// mede o movimento e a segurança do comércio, não o acesso: toda sala conta como alcançável (acesso: acesso.test.js)
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

const world = () => { const g = mk(120); g.msg = () => {}; g.star = 5; for (let L = 1; L <= 4; L++) g.placeFloorSpan(L, 0, 119); g.pop = 400; g.t = 5 * 1440 + 8 * 60; return g; };
const crowd = (g, L, x, n) => { const o = put(g, 'office', L, x); o.occ = true; o.persons = new Array(n).fill(0); return o; };
const days = (g, n) => { for (let i = 0; i < n; i++) { g.t += 1440; g.bizDaily(); } };

{
  const biz = ['cafe', 'fastfood', 'restaurant', 'bar', 'mercado', 'lavanderia', 'banco', 'academia', 'creche'];
  ok(biz.every(k => FAC[k].biz) && !FAC.office.biz && !FAC.jardim.biz, 'valem para comércios e serviços (não para escritórios, apartamentos ou o jardim)');
}
// sem movimento: fecha depois de BIZ.days dias seguidos
{
  const g = world(); const c = put(g, 'cafe', 1, 40); const msgs = []; g.msg = t => msgs.push(t);
  days(g, BIZ.days - 1); ok(!c.closed, `com ${BIZ.days - 1} dias ruins ainda abre`);
  days(g, 1); ok(c.closed && /pouco movimento/.test(c.closeWhy) && msgs.some(m => /fechou/.test(m)), 'no ' + BIZ.days + 'º dia sem gente por perto o café fecha e avisa o motivo');
  const f0 = g.funds; g.t += 1440; for (const f of g.facs) if (FAC[f.k].dailyCost && f.build >= 1 && !f.closed) g.expense('daily', FAC[f.k].dailyCost);
  ok(!g.dayCtx().open.includes(c), 'fechado não recebe visitantes nem funcionários (fora do dia)');
  const o = crowd(g, 1, 52); ok(g.demandFactors(o).find(d => d.svc === 'cafe') && !g.demandFactors(o).find(d => d.svc === 'cafe').met, 'e deixa de contar como serviço: o escritório do lado volta a "faltar café"');
  ok(g.trashOf(c) === 0, 'fechado não gera lixo');
  ok(g.alerts().some(a => /Ponto vago/.test(a.title)), 'aparece um alerta de ponto vago');
}
// com movimento não fecha; o contador zera aos poucos
{
  const g = world(); const c = put(g, 'cafe', 1, 40); crowd(g, 1, 52, 30); crowd(g, 2, 40, 30);
  days(g, 6); ok(!c.closed && !c.idle, 'com gente por perto o café segue aberto');
  const g2 = world(); const c2 = put(g2, 'cafe', 1, 40); days(g2, 2); ok(c2.idle === 2, 'dois dias ruins acumulam'); crowd(g2, 1, 52, 30); crowd(g2, 2, 40, 30); days(g2, 1); ok(c2.idle === 1 && !c2.closed, 'e um dia bom alivia');
}
// insegurança também fecha
{
  const g = world(); const c = put(g, 'mercado', 1, 40); crowd(g, 1, 56, 30); crowd(g, 2, 40, 30);
  for (let i = 0; i < 4; i++) g.addIncident('theft', c); g.addIncident('fight', c); g.addIncident('bomb', c);
  const b = g.bizState(c); ok(b.safe < BIZ.minSafe && /insegurança/.test(b.why), 'com furtos, briga e bomba por perto o ponto fica inseguro (' + b.safe.toFixed(2) + ')');
  for (let i = 0; i < BIZ.days; i++) { g.addIncident('theft', c); g.addIncident('theft', c); g.addIncident('theft', c); g.addIncident('fight', c); g.addIncident('bomb', c); days(g, 1); }   // as ocorrências somem em alguns dias: a insegurança tem que durar
  ok(c.closed && /insegurança/.test(c.closeWhy), 'se a insegurança dura, o comerciante se muda por isso');
}
// reabre quando melhora
{
  const g = world(); const c = put(g, 'academia', 1, 40); days(g, BIZ.days); ok(c.closed, 'academia fechou');
  days(g, 5); ok(c.closed, 'sem movimento ela continua fechada');
  crowd(g, 1, 56, 30); crowd(g, 2, 40, 30); crowd(g, 3, 40, 30); const orig = Math.random; Math.random = () => 0;
  try { g.t += 1440; g.bizDaily(); } finally { Math.random = orig; }
  ok(!c.closed && !c.closeWhy, 'com o movimento de volta um novo comerciante abre');
}
// não começa a fechar cedo demais
{
  const g = world(); g.pop = 100; const c = put(g, 'cafe', 1, 40); days(g, 10); ok(!c.closed, 'torre pequena (menos de ' + BIZ.minPopDay + ' pessoas) não fecha comércio');
  const g2 = world(); g2.t = 1 * 1440; const c2 = put(g2, 'cafe', 1, 40); g2.bizDaily(); g2.bizDaily(); g2.bizDaily(); ok(!c2.closed && !c2.idle, 'nos primeiros dias também não');
}
// custo diário e salvar/carregar
{
  const g = world(); const c = put(g, 'academia', 1, 40); const dc = FAC.academia.dailyCost; days(g, BIZ.days); c.idle = 2; const r = roundTrip(g), rc = r.facs.find(f => f.k === 'academia');
  ok(rc.closed && rc.closeWhy === c.closeWhy, 'fechado e o motivo vão no save');
  const old = JSON.parse(JSON.stringify(g.serialize())); for (const f of old.facs) { delete f.cl; delete f.ci; delete f.cw; } const h = world(); h.load(old); ok(!h.facs.find(f => f.k === 'academia').closed, 'save antigo carrega com tudo aberto');
}
done('comercio');
