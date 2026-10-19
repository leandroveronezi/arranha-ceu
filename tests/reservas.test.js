'use strict';
// Reservatórios: cada bateria (energia) e caixa d'água (água) guarda o PRÓPRIO nível. Enchem com a sobra das fontes ao alcance e esvaziam no consumo das salas por perto.
// Bomba só no subsolo e só enche caixa que está ACIMA dela (a sobra é repartida entre as caixas); a bateria também é carregada por outra bateria mais cheia por perto (uma alimenta a próxima).
const {FAC, UTIL, USE, OUTAGE, ok, done, mk: mk0, put, roundTrip, REAL_GRID} = require('./helpers');
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };   // o assunto aqui são as reservas, não o acesso

const world = (floors = 4) => { const g = mk(120); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 119); g.placeFloorSpan(-2, 0, 119); for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, 119); return g; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const withGrid = (e, a, fn) => { const old = {...UTIL.grid}; UTIL.grid.energia = e; UTIL.grid.agua = a; try { fn(); } finally { Object.assign(UTIL.grid, old); } };
const office = (g, L, x) => { const f = put(g, 'office', L, x); f.occ = true; return f; };
const lvl = f => g0.storeLvl(f);
let g0;

{
  ok(FAC.bateria.util.store.res === 'energia' && !FAC.bateria.util.store.pump && FAC.caixa.util.store.res === 'agua' && FAC.caixa.util.store.pump, 'bateria guarda energia sem bomba; a caixa guarda água e só enche com bomba');
  ok(FAC.bomba.underOnly && FAC.bombaMedia.underOnly && FAC.bombaForte.underOnly, 'bombas só no subsolo');
  ok(FAC.bombaMedia.util.agua === 2 * FAC.bomba.util.agua && FAC.bombaMedia.util.reach === 2 * FAC.bomba.util.reach && FAC.bombaForte.util.agua === 4 * FAC.bomba.util.agua, 'bombas maiores: 2x e 4x a vazão, e alcance maior');
  const g = world(); const r = g.placeFac('bomba', 2, 0); ok(!r.ok, 'bomba não pode ficar acima do solo');
  ok(REAL_GRID.agua === 0 && REAL_GRID.energia > 0 && REAL_GRID.energia < 1000, 'a rede pública é só de energia e é pouca (água só vem de bomba)');
  ok(FAC.gerador.star === 1 && FAC.bomba.star === 1 && FAC.caixa.star === 1, 'gerador, bomba e caixa já no 1★');
}

// bateria enche com a sobra da rede e para na capacidade
{
  withGrid(1000, 0, () => {
    const g = world(); g0 = g; const b = put(g, 'bateria', -1, 0); office(g, 1, 0);
    const use = g.utilFresh().energia.use, surplus = 1000 - use;
    ok(lvl(b) === 0 && g.utilFresh().energia.storeCap === FAC.bateria.util.store.cap, 'bateria nova começa vazia');
    g.utilTick(); ok(near(lvl(b), Math.min(surplus, FAC.bateria.util.store.fill)), 'cada hora a sobra da rede enche a bateria (até a taxa de carga): ' + lvl(b).toFixed(0));
    for (let i = 0; i < 10; i++) g.utilTick(); ok(near(lvl(b), FAC.bateria.util.store.cap), 'e para na capacidade (' + lvl(b) + ')');
    b.dead = true; g.dirty(); g.utilTick(); ok(g.store.energia === 0, 'sem a bateria o total some');
  });
}

// geradores carregam a bateria; no déficit ela esvazia, e vazia deixa de ajudar
{
  withGrid(0, 0, () => {
    const g = world(); g0 = g; put(g, 'gerador', -1, 0); put(g, 'gerador', -1, 8); const b = put(g, 'bateria', -1, 24); office(g, 1, 0);
    g.utilTick(); ok(lvl(b) > 0, 'os geradores carregam a bateria (a rede externa não é obrigatória)');
    for (let i = 0; i < 10; i++) g.utilTick(); const full = lvl(b);
    const oldUse = USE.office[0]; USE.office[0] = 4;
    for (let L = 1; L <= 4; L++) for (const x of [0, 20, 40, 60]) { try { office(g, L, x); } catch (e) {} }
    try {
      const u = g.utilFresh().energia; ok(u.use > u.cap - lvl(b), 'a torre cheia consome mais do que os geradores produzem');
      g._utk = null; const cutFull = g.utilFresh().energia.cut; g.utilTick(); ok(lvl(b) < full, 'no déficit a bateria esvazia (' + full + ' → ' + lvl(b).toFixed(0) + ')');
      let cuts = []; for (let i = 0; i < 40; i++) { g.utilTick(); g._utk = null; cuts.push(g.utilFresh().energia.cut); }
      ok(lvl(b) < 40 && cuts[cuts.length - 1] > cutFull, 'quase vazia (menos que uma sala consome), a bateria deixa de ajudar e cortes aparecem (' + cutFull + ' → ' + cuts[cuts.length - 1] + ')');
    } finally { USE.office[0] = oldUse; }
  });
}

// cadeia de baterias: gerador no subsolo carrega a bateria 1; a bateria 2 (fora do alcance do gerador, mas ao alcance da bateria 1) é carregada pela 1; e assim por diante
{
  withGrid(0, 0, () => {
    const g = world(30); g0 = g;
    put(g, 'gerador', -1, 0); put(g, 'gerador', -1, 8); put(g, 'gerador', -1, 16);
    const b1 = put(g, 'bateria', 8, 0), b2 = put(g, 'bateria', 16, 0), b3 = put(g, 'bateria', 24, 0), far = put(g, 'bateria', 30, 40);
    for (let i = 0; i < 40; i++) g.utilTick();
    ok(lvl(b1) > 0, 'a bateria do andar 9 é carregada pelo gerador do subsolo (a ~9 andares)');
    ok(lvl(b2) > 0 && lvl(b3) > 0, 'e ela alimenta a do andar 17, que alimenta a do 25: a cadeia sobe (' + [b1, b2, b3].map(b => Math.round(lvl(b))).join('/') + ')');
    ok(g.roomDist(g.facs.find(f => f.k === 'gerador'), b3) > UTIL.reach.own, 'a última está fora do alcance do gerador: só chegou pela cadeia');
    ok(lvl(far) === 0 || g.roomDist(b3, far) <= UTIL.reach.own, 'bateria fora do alcance de qualquer fonte ou bateria fica vazia');
  });
}

// energia: em apagão a bateria cheia mantém quem está ao alcance
{
  withGrid(1000, 0, () => {
    const g = world(); g0 = g; const b = put(g, 'bateria', -1, 0), r = office(g, 1, 0);
    b.lvl = FAC.bateria.util.store.cap; g.outage.energia = g.t + 120; g._utk = null;
    const u = g.utilFresh().energia;
    ok(u.out && near(u.cap, FAC.bateria.util.store.rate) && u.cut === 0 && !r.cutE, 'em apagão a bateria cheia mantém as salas ligadas');
    const h = world(); h.outage.energia = h.t + 120; h._utk = null; ok(h.utilFresh().energia.cap === 0, 'sem bateria o apagão zera a capacidade');
  });
}

// água: bomba (subsolo) enche as caixas ACIMA dela, repartindo a sobra; caixa sem bomba abaixo ou fora do alcance não enche
{
  withGrid(1e9, 0, () => {
    const g = world(); g0 = g; office(g, 1, 0);
    const c = put(g, 'caixa', 2, 100);
    g.utilTick(); ok(lvl(c) === 0, 'sem bomba a caixa não enche');
    const p = put(g, 'bomba', -1, 80), sur = FAC.bomba.util.agua - g.utilFresh().agua.use;
    g.utilTick(); ok(near(lvl(c), Math.min(sur, FAC.caixa.util.store.fill), 1e-3), 'com a bomba abaixo a caixa enche com a sobra de água (' + lvl(c).toFixed(1) + ')');
    for (let i = 0; i < 30; i++) g.utilTick(); ok(near(lvl(c), FAC.caixa.util.store.cap), 'até a capacidade');
    p.dead = true; g.dirty(); g.utilTick(); ok(lvl(c) > 0, 'sem a bomba a água guardada continua lá (a caixa só deixa de encher)');
  });
  withGrid(1e9, 0, () => {   // várias caixas acima de uma bomba: a sobra é repartida
    const g = world(10); g0 = g; const p = put(g, 'bombaMedia', -1, 80);
    const c1 = put(g, 'caixa', 2, 80), c2 = put(g, 'caixa', 4, 80), c3 = put(g, 'caixa', 6, 80);
    g.utilTick(); const l = [c1, c2, c3].map(lvl);
    ok(near(l[0], l[1]) && near(l[1], l[2]) && l[0] > 0, 'três caixas acima da mesma bomba enchem por igual (' + l.map(v => v.toFixed(0)).join('/') + ')');
    ok(near(l[0] + l[1] + l[2], Math.min(FAC.bombaMedia.util.agua, 3 * FAC.caixa.util.store.fill)), 'o total enchido é a vazão da bomba (ou o que as caixas aceitam por hora)');
    const o = put(g, 'caixa', -2, 100);   // abaixo da bomba: a bomba não a enche (a água só sobe)
    for (let i = 0; i < 3; i++) g.utilTick(); ok(lvl(o) > 0, 'mas as caixas de cima a enchem por gravidade (a água desce de graça: ' + lvl(o).toFixed(0) + ')');
    const p2 = world(); g0 = p2; put(p2, 'caixa', -2, 100); put(p2, 'bomba', -1, 80); for (let i = 0; i < 3; i++) p2.utilTick(); ok(lvl(p2.facs.find(f => f.k === 'caixa')) === 0, 'sozinha, a bomba do andar -1 não enche a caixa do andar -2, que está abaixo dela');
  });
  withGrid(1e9, 0, () => {   // a bomba que só abastece o prédio não sobra nada: caixa vazia não gera nem consome
    const g = world(); g0 = g; const c = put(g, 'caixa', 2, 100); const p = put(g, 'bomba', -1, 80);
    const old = USE.office[1]; USE.office[1] = FAC.bomba.util.agua / 8;   // um escritório consome exatamente a vazão da bomba
    try { const o = office(g, 1, 0); g._utk = null; const u = g.utilFresh().agua; ok(near(u.use, FAC.bomba.util.agua), 'o prédio consome toda a vazão da bomba');
      g.utilTick(); ok(lvl(c) === 0, 'sem sobra a caixa não enche'); ok(!o.cutA, 'e o prédio é atendido pela bomba'); } finally { USE.office[1] = old; }
  });
  withGrid(1e9, 0, () => {   // alcance: a bomba comum não chega a uma caixa muito alta; a industrial chega
    const g = world(40); g0 = g; const c = put(g, 'caixa', 36, 80); put(g, 'bomba', -1, 80);
    for (let i = 0; i < 5; i++) g.utilTick(); ok(lvl(c) === 0, 'caixa no andar 37 fora do alcance da bomba comum (12 andares)');
    put(g, 'bombaForte', -1, 96); for (let i = 0; i < 5; i++) g.utilTick(); ok(lvl(c) > 0, 'a bomba industrial (80 andares) enche a mesma caixa');
  });
}

// gravidade e recalque: a caixa só abastece o que está no andar dela ou abaixo; para subir água de uma caixa para outra acima é preciso uma bomba de recalque com energia
{
  withGrid(1e9, 0, () => {
    const g = world(10); g0 = g; put(g, 'bombaMedia', -1, 80);
    const low = put(g, 'caixa', 2, 80), high = put(g, 'caixa', 8, 80);
    const aboveRoom = office(g, 6, 0), belowRoom = office(g, 1, 0); low.lvl = FAC.caixa.util.store.cap;
    for (let i = 0; i < 6; i++) g.utilTick();
    ok(lvl(high) > 0 && lvl(high) === lvl(high), 'a bomba de subsolo (alcance de 32 andares) enche a caixa alta diretamente');
    const g2 = world(40); g0 = g2; put(g2, 'bomba', -1, 80); const a = put(g2, 'caixa', 10, 80), b = put(g2, 'caixa', 18, 80); a.lvl = FAC.caixa.util.store.cap;
    for (let i = 0; i < 10; i++) g2.utilTick(); ok(lvl(b) === 0, 'sem recalque a caixa do andar 11 não sobe água para a do andar 19');
    put(g2, 'bombaRecalque', 10, 100); for (let i = 0; i < 10; i++) g2.utilTick(); ok(lvl(b) > 0 && lvl(b) <= FAC.bombaRecalque.util.lift * 10 + 1e-6, 'com a bomba de recalque ao lado, a água sobe, limitada à vazão dela (' + lvl(b).toFixed(0) + ')');
    const c = world(40); g0 = c; const hi = put(c, 'caixa', 18, 80), lo = put(c, 'caixa', 10, 80); hi.lvl = FAC.caixa.util.store.cap;
    for (let i = 0; i < 10; i++) c.utilTick(); ok(lvl(lo) > 0, 'e para baixo a água desce sem bomba nenhuma');
  });
  withGrid(0, 0, () => {   // sem energia o recalque não eleva
    const g = world(40); g0 = g; put(g, 'bomba', -1, 80); const a = put(g, 'caixa', 10, 80), b = put(g, 'caixa', 18, 80); put(g, 'bombaRecalque', 10, 100); a.lvl = FAC.caixa.util.store.cap;
    for (let i = 0; i < 6; i++) g.utilTick(); ok(lvl(b) === 0, 'sem energia a bomba de recalque não eleva nada');
  });
  withGrid(1e9, 0, () => {   // a caixa só abastece o andar dela e os de baixo
    const g = world(10); g0 = g; const cx = put(g, 'caixa', 4, 80); cx.lvl = FAC.caixa.util.store.cap;
    const up = office(g, 8, 72), down = office(g, 2, 72); g.outage.agua = g.t + 120; g._utk = null; g.utilFresh();
    ok(!down.cutA && up.cutA, 'em falta d\'água (sem bomba) a caixa abastece a sala abaixo dela e não a que está acima');
  });
}

// a caixa cheia cobre o consumo acima da vazão da bomba quando a bomba falha, e a mensagem explica
{
  const old = USE.office[1];
  try {
    const mkw = u => { USE.office[1] = u; const g = world(); g0 = g; put(g, 'bomba', -1, 40); const cx = put(g, 'caixa', 2, 16); const a = office(g, 1, 0), b = office(g, 2, 0); cx.lvl = FAC.caixa.util.store.cap; g.pop = 400; g.outage.agua = g.t + 200; g._utk = null; return {g, a, b}; };
    withGrid(1e9, 0, () => {
      const light = mkw(20), ul = light.g.utilFresh().agua;
      ok(ul.cut === 0 && ul.use > FAC.bomba.util.agua && !light.a.cutA, `com a caixa cheia, um consumo acima da bomba (${ul.use.toFixed(0)} > ${FAC.bomba.util.agua}) é coberto pela reserva`);
      const heavy = mkw(80), uh = heavy.g.utilFresh().agua;
      ok(uh.cut > 0 && uh.use - heavy.g.utilFlow('agua') > FAC.caixa.util.store.rate, 'se o déficit passa do que a reserva entrega por hora, há corte mesmo com a caixa cheia');
      ok(/reserva entrega no máximo|fonte mais próxima/.test(heavy.g.evalBreakdown(heavy.a).concat(heavy.g.evalBreakdown(heavy.b)).find(o => o.key === 'util:agua').label), 'e o motivo explica o limite');
      ok(Number.isFinite(light.g.reserveHours('agua')) && light.g.reserveHours('agua') >= 0, 'dá para estimar quantas horas a reserva segura');
    });
  } finally { USE.office[1] = old; }
}

// salvar e carregar o nível de cada reserva; save antigo (nível global) é repartido
{
  const g = world(); g0 = g; const a = put(g, 'bateria', -1, 0), b = put(g, 'bateria', -1, 8); a.lvl = 321; b.lvl = 100;
  const r = roundTrip(g), rs = r.facs.filter(f => f.k === 'bateria');
  ok(rs.length === 2 && Math.round(rs[0].lvl) === 321 && Math.round(rs[1].lvl) === 100, 'o nível de cada bateria vai no save');
  const old = JSON.parse(JSON.stringify(g.serialize())); old.facs.forEach(o => delete o.lv); old.store = {energia: 500, agua: 0};
  const h = world(); h.load(old); const hs = h.facs.filter(f => f.k === 'bateria');
  ok(hs.every(f => f.lvl > 0) && near(hs.reduce((s, f) => s + f.lvl, 0), 500, 1e-6), 'save antigo (nível global) é repartido pelas baterias');
}
done('reservas');
