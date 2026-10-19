'use strict';
// Caixas d'água em quatro tamanhos (simples, média, grande) e a torre pressurizada (5★), que traz uma bomba de recalque embutida.
const {FAC, UTIL, ok, done, mk: mk0, put} = require('./helpers');
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };
const world = (floors = 4) => { const g = mk(120); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 119); for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, 119); g.dirty(); return g; };
const withGrid = (e, fn) => { const old = {...UTIL.grid}; UTIL.grid.energia = e; UTIL.grid.agua = 0; try { fn(); } finally { Object.assign(UTIL.grid, old); } };
const st = k => FAC[k].util.store, ks = ['caixa', 'caixaMedia', 'caixaGrande', 'caixaTorre'];

ok(ks.every(k => st(k).res === 'agua' && st(k).pump && st(k).down), 'as quatro caixas guardam água, precisam de bomba para subir e só abastecem para baixo');
ok(ks.every((k, i) => !i || (st(k).cap > st(ks[i - 1]).cap * (k === 'caixaTorre' ? .6 : 1) && FAC[k].star > FAC[ks[i - 1]].star - 0 && FAC[k].cost > FAC[ks[i - 1]].cost)), 'capacidade, estrela e custo crescem a cada nível');
ok(st('caixaMedia').cap === 3 * st('caixa').cap && st('caixaGrande').cap >= 10 * st('caixa').cap, 'média = 3× e grande = 10× a caixa simples');
ok(FAC.caixaTorre.star === 5 && FAC.caixaTorre.util.lift > 0 && !FAC.caixa.util.lift && !FAC.caixaMedia.util.lift && !FAC.caixaGrande.util.lift, 'só a torre (5★) tem recalque embutido');

withGrid(1e9, () => {
  for (const k of ks) {   // cada uma enche com bomba abaixo, até a capacidade dela
    const g = world(); g.utilFresh(); put(g, 'bombaForte', -1, 80); const c = put(g, k, 2, 80);
    for (let i = 0; i < 40; i++) g.utilTick(); ok(Math.abs(g.storeLvl(c) - st(k).cap) < 1e-6, k + ' enche até a própria capacidade (' + g.storeLvl(c).toFixed(0) + ')');
  }
  // recalque embutido: a torre enche como as outras (bomba de baixo) e manda a própria água para as caixas acima, sem bomba de recalque
  const mkw = top => { const g = world(45); put(g, 'bomba', -1, 80); const tw = put(g, 'caixaTorre', 6, 100), hi = put(g, top, 12, 80); put(g, 'gerador', 7, 64); return {g, tw, hi}; };
  const a = mkw('caixa'); a.tw.lvl = st('caixaTorre').cap;
  for (let i = 0; i < 10; i++) a.g.utilTick();
  ok(a.g.storeLvl(a.hi) > 0 && a.g.storeLvl(a.hi) <= FAC.caixaTorre.util.lift * 10 + 1e-6, 'a torre bombeia a própria água para a caixa de cima (' + a.g.storeLvl(a.hi).toFixed(0) + ')');
  ok(a.g.storeLvl(a.hi) === st('caixa').cap, 'e enche a caixa de cima até a capacidade dela');
  const b = mkw('caixaGrande'); b.tw.lvl = st('caixaTorre').cap; b.g.utilTick();
  ok(b.g.storeLvl(b.hi) <= FAC.caixaTorre.util.lift + 1e-6 && b.g.storeLvl(b.hi) > 0, 'por hora ela manda no máximo a vazão do recalque embutido (' + b.g.storeLvl(b.hi).toFixed(0) + ' de ' + FAC.caixaTorre.util.lift + ')');
  // as outras caixas não têm recalque: a água de uma caixa simples não sobe para a de cima
  const g2 = world(45); put(g2, 'bomba', -1, 80); const lo2 = put(g2, 'caixa', 20, 80), hi2 = put(g2, 'caixaGrande', 23, 100); lo2.lvl = st('caixa').cap;
  for (let i = 0; i < 10; i++) g2.utilTick(); ok(g2.storeLvl(hi2) === 0, 'a caixa simples/grande não sobe água sozinha');
});
withGrid(0, () => {   // sem energia a torre não bombeia para cima (mas guarda)
  const g = world(45); put(g, 'bomba', -1, 80); const tw = put(g, 'caixaTorre', 6, 100), hi = put(g, 'caixa', 12, 80); tw.lvl = st('caixaTorre').cap;
  for (let i = 0; i < 6; i++) g.utilTick(); ok(g.storeLvl(hi) === 0 && g.storeLvl(tw) > 0, 'sem energia a torre não bombeia para cima');
});
done('caixas');
