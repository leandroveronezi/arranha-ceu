'use strict';
// Baterias em três tamanhos: pequena (1 casa, 1/3 da comum, 2★), comum (3★) e grande (3 casas, 3× a comum, 4★).
const {FAC, UTIL, ok, done, mk: mk0, put} = require('./helpers');
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };
const ks = ['bateriaPequena', 'bateria', 'bateriaGrande'], st = k => FAC[k].util.store;
ok(ks.every(k => st(k).res === 'energia' && !st(k).pump), 'as três guardam energia');
ok(ks.every((k, i) => !i || (FAC[k].star > FAC[ks[i - 1]].star && st(k).cap > st(ks[i - 1]).cap && FAC[k].cost > FAC[ks[i - 1]].cost && FAC[k].w > FAC[ks[i - 1]].w - 1)), 'estrela, capacidade, custo e tamanho crescem');
ok(FAC.bateriaPequena.w === 4 && FAC.bateriaGrande.w === 12 && FAC.bateriaPequena.cost * 2 === FAC.bateria.cost && FAC.bateriaGrande.cost === 300000, 'pequena 1 casa por R$ 100 mil, grande 3 casas por R$ 300 mil');
ok(Math.abs(st('bateriaPequena').cap * 3 - st('bateria').cap) < 3 && Math.abs(st('bateriaPequena').rate * 3 - st('bateria').rate) < 3 && st('bateriaGrande').cap === 3 * st('bateria').cap, 'pequena = 1/3 e grande = 3× a bateria comum');
const old = {...UTIL.grid};
try {
  for (const k of ks) {
    const g = mk(60); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 59); g.dirty();
    UTIL.grid.energia = 1e9; UTIL.grid.agua = 0;
    const b = put(g, k, -1, 8); for (let i = 0; i < 40; i++) g.utilTick();
    ok(Math.abs(g.storeLvl(b) - st(k).cap) < 1e-6, k + ' enche até a capacidade (' + g.storeLvl(b).toFixed(0) + ')');
  }
} finally { Object.assign(UTIL.grid, old); }
done('baterias');
