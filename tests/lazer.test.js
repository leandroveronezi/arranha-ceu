'use strict';
// Academia, creche, piscina/spa e auditório: catálogo, altura 2, barulho, demanda de moradores/escritórios/hotel e convenções nos dias úteis.
const {FAC, DEMAND, DEMAND_EXTRA, DEMANDV, NOISE, ok, done, mk, put} = require('./helpers');

const world = () => { const g = mk(240); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 239); for (let L = 1; L <= 6; L++) g.placeFloorSpan(L, 0, 239); for (let L = 0; L < 7; L++) g.placeStairs('stairs', L, 200); return g; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

{
  ok(FAC.academia.star === 2 && FAC.creche.star === 3 && FAC.piscina.star === 4 && FAC.auditorio.star === 4, 'estrelas: academia 2★, creche 3★, piscina 4★, auditório 4★');
  ok(FAC.piscina.h === 2 && FAC.auditorio.h === 2 && FAC.academia.h === 1 && FAC.creche.h === 1, 'piscina e auditório ocupam 2 andares');
  ok(FAC.academia.noisy && FAC.auditorio.noisy && !FAC.creche.noisy && !FAC.piscina.noisy, 'academia e auditório fazem barulho; creche e piscina não');
  ok([FAC.academia, FAC.creche, FAC.piscina, FAC.auditorio].every(d => d.dailyCost > 0 && !d.commercial), 'todas têm manutenção diária');
  const g = world(); ok(g.canPlaceFac('piscina', 1, 0).ok && g.canPlaceFac('auditorio', 1, 24).ok, 'as de altura 2 cabem onde há dois andares livres');
}

// demanda: quem procura o quê
{
  const wants = k => [...(DEMAND[k] || []), ...(DEMAND_EXTRA[k] || [])];
  ok(wants('coworking').includes('academia') && wants('office').includes('academia') && ['condo', 'penthouse', 'kitnet'].every(k => !wants(k).includes('academia')), 'academia: escritório e coworking (extra); nunca moradia, que sofre com o barulho');
  ok(DEMAND.condo.includes('creche') && !DEMAND.kitnet.includes('creche'), 'creche: só apartamentos (família)');
  ok(['twin', 'suite', 'penthouse'].every(k => DEMAND[k].includes('piscina')), 'piscina: quarto duplo, suíte e coberturas');
  ok(['twin', 'officeEx'].every(k => wants(k).includes('convencoes')) && !wants('single').includes('convencoes') && !wants('suite').includes('convencoes'), 'convenções: quarto duplo e escritório executivo (o auditório é barulhento para o quarto simples e a suíte)');
  const g = world(); const suite = put(g, 'suite', 1, 0), apt = put(g, 'condo', 2, 0);
  const b = g.evalFac(suite); put(g, 'piscina', 1, 24);   // dois andares, ao lado
  ok(g.demandFactors(suite).find(d => d.svc === 'piscina').met && g.evalFac(suite) > b, 'a suíte ganha "Tem piscina e spa por perto"');
  put(g, 'creche', 3, 0);
  ok(g.demandFactors(apt).find(d => d.svc === 'creche').met, 'o apartamento ganha "Tem creche por perto"');
}

// academia incomoda os vizinhos (barulho) mas compensa na demanda
{
  const g = world(); const apt = put(g, 'condo', 1, 0); const n0 = g.noiseOf(apt); put(g, 'academia', 1, 16);
  const off = put(g, 'coworking', 1, 32);
  ok(g.noiseOf(apt) > n0 && g.evalBreakdown(apt).find(o => o.key === 'noise').v < 0 && !g.demandFactors(apt).some(d => d.svc === 'academia'), 'a academia faz barulho para o apartamento ao lado, que por isso nem a pede');
  ok(g.demandFactors(off).find(d => d.svc === 'academia').met, 'e atende o escritório, que não sofre com o barulho');
}

// auditório: convenções nos dias úteis, receita por participante
{
  const g = world(); g.pop = 400;
  const au = put(g, 'auditorio', 1, 0);
  for (let i = 0; i < 6; i++) { const o = put(g, 'office', 3 + (i >= 3 ? 1 : 0), (i % 3) * 8); o.occ = true; o.persons = new Array(12).fill(0); }
  g.t = 1 * 1440 + 6 * 60; g.people = [];   // dia 1: dia útil
  ok(!g.weekend, 'o dia do teste é útil');
  g.planCrowd(g.dayCtx());
  const n = g.people.filter(p => p.kind === 'visitor' && p.plan[0].fac === au).length;
  ok(n >= 15 && n <= 80, `o auditório recebe participantes nos dias úteis (${n})`);
  const f0 = g.funds; g.income('auditorio', 500);
  ok(g.funds - f0 === 500 && g.fin.cur.inc.auditorio === 500, 'a receita entra na categoria "Auditório"');
  const w = world(); w.pop = 400; const a2 = put(w, 'auditorio', 1, 0); w.t = 5 * 1440 + 6 * 60; w.people = [];
  if (w.weekend) { w.planCrowd(w.dayCtx()); ok(!w.people.some(p => p.plan[0] && p.plan[0].fac === a2), 'nos fins de semana não há convenção'); }
}
done('lazer');
