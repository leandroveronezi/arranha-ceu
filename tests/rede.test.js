'use strict';
// Energia e água são locais: a rede pública está presa aos saguões do térreo e as fontes próprias (gerador, bomba, bateria, caixa...) alcançam só as salas
// perto delas. Sala fora do alcance fica sem (cutE/cutA, motivo "reach"), não atende ninguém e o aviso diz por quê.
const {FAC, UTIL, ok, done, mk: mk0, put} = require('./helpers');
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };   // o assunto aqui é o alcance, não o acesso por escada

const tower = (floors = 40) => {
  const g = mk(64); g.msg = () => {}; g.star = 5; g.updPerson = () => {};
  g.placeFloorSpan(-1, 0, 63); for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, 63);
  const off = {}; for (let L = 1; L <= floors; L++) { off[L] = put(g, 'office', L, 8); off[L].occ = true; }
  g._utk = null; g.utilFresh();
  return {g, off};
};

{
  const {g, off} = tower();
  ok(!off[1].cutE && !off[8].cutE && !off[14].cutE, 'perto do saguão a rede pública chega (andares 1, 8 e 14)');
  ok(off[40].cutE && g.util.energia.reach > 0 && off[40].cutWhyE === 'reach', 'no andar 40 nenhuma fonte alcança: sem energia, motivo "reach"');
  ok(off[40].cutA && off[40].cutWhyA === 'reach', 'e sem água também');
  ok(!g.serves(off[40]) && g.serves(off[1]), 'sala sem energia não atende ninguém; a perto do saguão atende');
  ok(g.evalBreakdown(off[40]).some(d => d.key === 'util:energia' && /alcance/i.test(d.label)), 'o motivo na nota explica que não há fonte ao alcance');
  put(g, 'gerador', 36, 40); g._utk = null; g.utilFresh();
  ok(!off[40].cutE && !off[30].cutE && off[40].cutA, 'um gerador no andar 36 acende os andares ao redor (energia), mas a água continua faltando');
  ok(off[22].cutE, 'e não chega ao andar 22, fora de todos os alcances');
  put(g, 'bombaForte', -1, 40); g._utk = null; g.utilFresh();
  ok(!off[40].cutA, 'uma bomba industrial no subsolo leva água ao andar 40 (alcance de 80 andares)');
}

// o apagão derruba só a rede pública: quem tem gerador por perto continua
{
  const {g, off} = tower(10);
  put(g, 'gerador', 4, 40); g._utk = null; g.utilFresh();
  ok(!off[3].cutE && !off[9].cutE, 'com a rede, tudo ligado');
  g.outage.energia = g.t + 120; g._utk = null; g.utilFresh();
  ok(!off[4].cutE && off[9].cutE === (g.util.energia.cut > 0 && off[9].cutE), 'em apagão só vale o gerador: quem está ao alcance dele segue ligado');
  ok(off[1].cutE !== undefined && g.util.energia.out, 'o apagão aparece no resumo');
}

// capacidade: uma fonte não atende acima do que produz; o excesso fica sem, os de menor prioridade primeiro
{
  const old = UTIL.grid.energia; UTIL.grid.energia = 1;
  try {
    const {g, off} = tower(4);
    ok(Object.values(off).filter(f => f.cutE).length >= 3 && off[1].cutWhyE === 'cap', 'rede pequena demais: faltam capacidade e as salas ficam sem (motivo "cap")');
  } finally { UTIL.grid.energia = old; }
}

// elevador: o poço sem energia fica parado e ninguém espera por ele
{
  const {g} = tower(30);
  const r = g.placeShaft('elevator', 60, 0, 24); ok(r.ok, 'poço construído ' + (r.err || '')); g.addCar(r.shaft);
  g._utk = null; g.utilFresh();
  ok(r.shaft.dark === false, 'poço no meio da torre alcançado pela rede: ligado');
  const g2 = mk(64); g2.msg = () => {}; g2.star = 5; for (let L = 1; L <= 40; L++) g2.placeFloorSpan(L, 0, 63);
  const r2 = g2.placeShaft('elevator', 60, 32, 40); if (r2.ok) { g2.addCar(r2.shaft); g2._utk = null; g2.utilFresh(); ok(r2.shaft.dark === true && g2.carWait(r2.shaft, 33) > 1000, 'poço só nos andares 32–40, longe da rede: parado, e ninguém espera por ele'); }
}

// proteção: sprinklers/hidrantes/câmeras dependem de água/energia no próprio corredor
{
  const {g} = tower(40);
  const room = put(g, 'office', 39, 28), cor = put(g, 'corridorSpr', 39, 20), cam = put(g, 'corridorCam', 39, 24);
  g._utk = null; g.utilFresh();
  ok(cor.cutA && !g.corrNear(room, 'spr'), 'corredor com sprinklers fora do alcance da água: não protege');
  ok(cam.cutE && !g.corrNear(room, 'cam'), 'câmera fora do alcance da energia: falha');
  put(g, 'bombaForte', -1, 40); put(g, 'gerador', 38, 48); g._utk = null; g.utilFresh();
  ok(!cor.cutA && g.corrNear(room, 'spr') && !cam.cutE && g.corrNear(room, 'cam'), 'com bomba e gerador por perto, ambos voltam a proteger');
}
// quem produz não consome: gerador, bateria e caixa d'água não gastam nada; a bomba gasta energia (e sem ela não bombeia); elevador usa energia mas não água; utilidades funcionam sem escada
{
  const old = {...UTIL.grid}; UTIL.grid.energia = 0; UTIL.grid.agua = 0;
  try {
    const g = mk(64); g.msg = () => {}; g.star = 5; g.reachable = f => false;   // nada tem acesso por escada
    g.placeFloorSpan(-1, 0, 63);
    const gas = put(g, 'geradorGas', -1, 0), bat = put(g, 'bateria', -1, 8), cx = put(g, 'caixa', 1, 16 - 0) ;
    g._utk = null; g.utilFresh();
    ok(!gas.cutE && !gas.cutA && !bat.cutE && !bat.cutA && !cx.cutE && !cx.cutA, 'gerador a gás, bateria e caixa d\'água não precisam de energia nem de água');
    ok(g.util.energia.cap >= FAC.geradorGas.util.energia, 'o gerador produz mesmo sem escada até ele (utilidade é infraestrutura)');
    const pump = put(g, 'bomba', -1, 24); g._utk = null; g.utilFresh();
    ok(!pump.cutE && g.util.agua.cap === FAC.bomba.util.agua, 'a bomba perto do gerador tem energia e bombeia');
    g.facs.find(f => f.k === 'geradorGas').dead = true; g.dirty(); g._utk = null; g.utilFresh();
    ok(pump.cutE && g.util.agua.cap === 0, 'sem energia a bomba não bombeia (a bomba gasta energia)');
    const h = mk(64); h.msg = () => {}; h.star = 5; h.placeFloorSpan(-1, 0, 63); const r = h.placeShaft('elevator', 56, -1, 0); if (r.ok) { h.addCar(r.shaft); put(h, 'gerador', -1, 40); h._utk = null; h.utilFresh(); ok(r.shaft.dark === false && h.util.agua.use === 0, 'o elevador usa energia e não consome água'); }
  } finally { Object.assign(UTIL.grid, old); }
}
// corredor: o comum e o com extintor não precisam de nada; sprinkler e hidrante precisam de água; câmera precisa de energia
{
  const {g} = tower(40);
  const plain = put(g, 'corridor', 39, 20), ext = put(g, 'corridorExt', 39, 24), spr = put(g, 'corridorSpr', 39, 28), hyd = put(g, 'corridorHyd', 39, 32), cam = put(g, 'corridorCam', 39, 36);
  g._utk = null; g.utilFresh();
  ok(!plain.cutE && !plain.cutA && !ext.cutE && !ext.cutA, 'corredor comum e com extintor nunca ficam sem energia nem água');
  ok(spr.cutA && !spr.cutE && hyd.cutA && !hyd.cutE, 'sprinkler e hidrante precisam só de água (e estão fora do alcance)');
  ok(cam.cutE && !cam.cutA, 'câmera precisa só de energia');
  ok(g.corrNear(g.facs.find(f => f.k === 'office' && f.L === 39), 'ext'), 'o extintor segue funcionando longe da rede');
}
done('rede');
