'use strict';
// Energia e água: rede pública + fontes contra o consumo de cada sala; quem passa da capacidade cai por prioridade, e sem água sprinklers e hidrantes não funcionam.
const {FAC, UTIL, USE, UPRIO, NOISE, ok, done, mk: mk0, put} = require('./helpers');
// estes testes medem a regra do próprio assunto, não o acesso: toda sala conta como alcançável (acesso: acesso.test.js e invariantes.test.js)
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

const world = (floors = 6) => { const g = mk(120); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 119); for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, 119); return g; };
const get = (g, f, key) => g.evalBreakdown(f).find(o => o.key === key);
const near = (a, b) => Math.abs(a - b) < 1e-6;
const withGrid = (e, a, fn) => { const old = {...UTIL.grid}; UTIL.grid.energia = e; UTIL.grid.agua = a; try { fn(); } finally { Object.assign(UTIL.grid, old); } };

// 1. catálogo
{
  ok(FAC.gerador.util.energia > 0 && FAC.gerador.noisy && FAC.solar.roof && FAC.solar.util.solar && !FAC.solar.noisy && FAC.caixa.h === 2 && FAC.caixa.util.store.res === 'agua' && FAC.bomba.noisy && FAC.bomba.util.agua > 0 && FAC.tratamento.underOnly && FAC.tratamento.util.agua > FAC.bomba.util.agua, 'fontes: gerador (barulhento), placa solar (topo, silenciosa), caixa d\'água (2 andares), estação de tratamento (subsolo)');
  ok(FAC.gerador.star === 1 && FAC.solar.star === 3 && FAC.caixa.star === 1 && FAC.bomba.star === 1 && FAC.tratamento.star === 4, 'estrelas: gerador 1, solar 3, bomba e caixa 1, tratamento 4');
  ok(UPRIO.security > UPRIO.single && UPRIO.single > UPRIO.condo && UPRIO.condo > UPRIO.office && UPRIO.office > 2 - 0.5 && (UPRIO.shop ?? 2) < UPRIO.office, 'prioridade: segurança > hotel > moradia > escritório > comércio');
}

// 2. capacidade
{
  const g = world(); const base = g.utilCap('energia');
  ok(base === UTIL.grid.energia && g.utilCap('agua') === UTIL.grid.agua, 'sem fontes vale a rede pública');
  put(g, 'gerador', -1, 0);
  ok(near(g.utilCap('energia'), base + FAC.gerador.util.energia), 'o gerador soma a capacidade dele');
  const cx = put(g, 'caixa', 3, 100); g.utilTick(); ok(near(g.utilCap('agua'), UTIL.grid.agua) && g.storeLvl(cx) === 0, 'caixa d\'água sem bomba abaixo existe mas nunca enche (e vazia não fornece nada)');
  put(g, 'bomba', -1, 40); ok(near(g.utilCap('agua'), UTIL.grid.agua + FAC.bomba.util.agua), 'a bomba (subsolo) soma a vazão dela');
  g.t = 12 * 60; const noon = g.sun(); put(g, 'solar', 6, 0); const c12 = g.utilCap('energia');
  g.t = 23 * 60; const c23 = g.utilCap('energia');
  ok(noon > 0.99 && near(c12 - c23, FAC.solar.util.energia * noon) && g.sun() === 0, 'a placa solar rende ao meio-dia e nada à noite');
  const u = g.facs.find(f => f.k === 'gerador'); u.build = 0; ok(near(g.utilCap('energia'), c23 - FAC.gerador.util.energia), 'fonte em obras não conta');
}

// 3. consumo
{
  const g = world(); const off = put(g, 'office', 1, 0), apt = put(g, 'condo', 2, 0);
  const vac = g.utilUse(off, 0); off.occ = true;
  ok(near(g.utilUse(off, 0), vac / UTIL.vacant) && near(g.utilUse(off, 0), USE.office[0] * off.w), 'sala vaga gasta 20% da ocupada; ocupada gasta largura × consumo');
  ok(g.utilUse(apt, 1) > g.utilUse(off, 1) * 0.2 && USE.condo[1] > USE.office[1], 'apartamento gasta bem mais água que escritório');
  const sh = g.placeShaft('elevator', 100, 0, 6).shaft; const a = g.utilCalc().energia.use; g.addCar(sh); g.addCar(sh);
  ok(near(g.utilCalc().energia.use - a, 2 * UTIL.elevator), 'cada cabine de elevador consome energia');
  ok(g.utilUse(put(g, 'corridor', 3, 0), 0) === 0 && g.utilUse(put(g, 'jardim', 3, 20), 1) > 0, 'corredor não gasta; jardim gasta água');
}

// 4. déficit corta por prioridade
{
  withGrid(20, 1e9, () => {
    const g = world(); const sec = put(g, 'security', 1, 0), hotel = put(g, 'suite', 1, 40), apt = put(g, 'condo', 1, 60), off = put(g, 'office', 2, 0), shop = put(g, 'shop', 2, 20), pk = put(g, 'cafe', 2, 40);
    for (const f of [hotel, apt, off, shop, pk]) { f.occ = true; f.guests = f === hotel ? [{}] : []; }
    const u = g.utilCalc().energia;
    ok(u.use > u.cap && u.cut > 0, `consumo ${u.use.toFixed(0)} passa da capacidade ${u.cap}: ${u.cut} sala(s) cortadas`);
    ok(!sec.cutE, 'o posto de segurança é o último a cair');
    ok((!hotel.cutE || apt.cutE || off.cutE || shop.cutE || pk.cutE) && (!apt.cutE || off.cutE || shop.cutE || pk.cutE) && (!off.cutE || shop.cutE || pk.cutE), 'o corte vai de baixo para cima na prioridade: nunca corta moradia deixando comércio ligado');
    ok(pk.cutE && !g.facs.find(f => f.k === 'security').cutE, 'o comércio cai antes do posto');
    ok(!sec.cutA && !hotel.cutA && !apt.cutA, 'água sobra: ninguém sem água');
    put(g, 'gerador', -1, 40);
    ok(g.utilCalc().energia.cut < u.cut, 'um gerador devolve energia a quem estava cortado');
  });
}

// 5. motivos mostrados (nota = soma), aluguel e vacância
{
  withGrid(1e9, 1e9, () => {
    const g = world(); const apt = put(g, 'condo', 1, 0); apt.occ = true; g.moveIn(apt);
    const before = g.evalFac(apt); const b0 = g.rentChance(apt);
    UTIL.grid.energia = 0; UTIL.grid.agua = 0; g.t += 60;
    const m = get(g, apt, 'util:energia'), w = get(g, apt, 'util:agua');
    ok(m && m.v === -UTIL.penalty.energia && w && w.v === -UTIL.penalty.agua && /Sem energia/.test(m.label) && /Sem água/.test(w.label), 'sem energia e sem água aparecem como motivos negativos na nota');
    const tot = g.evalBreakdown(apt).reduce((a, o) => a + o.v, 0);
    ok(Math.abs(g.evalFac(apt) - Math.max(0, Math.min(300, tot))) < 1e-9 && g.evalFac(apt) < before, 'a nota continua sendo a soma dos motivos (' + before.toFixed(0) + ' → ' + g.evalFac(apt).toFixed(0) + ')');
    ok(near(g.rentChance(apt), b0 * UTIL.rent), 'unidade cortada atrai bem menos inquilinos (×' + UTIL.rent + ')');
    const off = put(g, 'office', 2, 0); const r = g.vacancyReasons(off);
    ok(r.some(x => /Sem energia/.test(x.text) && x.sev === 'bad') && r.some(x => /Sem água/.test(x.text)), '"Por que está vago?" diz que falta energia e água');
  });
}

// 6. água e sprinklers/hidrantes
{
  withGrid(1e9, 0, () => {
    const g = world(); const off = put(g, 'office', 1, 8); off.occ = true; put(g, 'corridorSpr', 1, 0); put(g, 'corridorHyd', 1, 16); put(g, 'corridorExt', 2, 8); put(g, 'corridorCam', 2, 20);
    ok(!g.corrNear(off, 'spr') && !g.corrNear(off, 'hyd') && off.cutA, 'sem água, sprinklers e hidrantes não funcionam');
    const sala = put(g, 'office', 2, 12); sala.occ = true; g.utilCalc();
    ok(g.corrNear(sala, 'ext') && g.corrNear(sala, 'cam'), 'extintor e câmera continuam valendo sem água');
    UTIL.grid.agua = 1e9; g.t += 60;
    ok(g.corrNear(off, 'spr') && g.corrNear(off, 'hyd'), 'com água de volta eles voltam a cobrir');
  });
}

// 7. placa solar só no topo; gerador faz barulho
{
  const g = world(); put(g, 'office', 6, 0);
  ok(!g.canPlaceFac('solar', 5, 0).ok && /topo/.test(g.canPlaceFac('solar', 5, 0).err), 'placa solar não vai com salas acima');
  const s = put(g, 'solar', 6, 40); ok(!g.canPlaceFac('office', 7, 40).ok, 'e nada se constrói em cima dela');
  const h = world(); const apt = put(h, 'condo', 1, 0); const n0 = h.noiseOf(apt); put(h, 'gerador', 1, 16);
  ok(h.noiseOf(apt) > n0 && NOISE.loud.includes('gerador'), 'o gerador faz barulho (alcance maior) para a unidade ao lado');
  const h2 = world(); const apt2 = put(h2, 'condo', 1, 0); put(h2, 'solar', 6, 0); ok(h2.noiseOf(apt2) === 0, 'a placa solar é silenciosa');
}
done('utilidades');
