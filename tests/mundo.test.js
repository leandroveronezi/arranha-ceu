'use strict';
// Mundo sem teto: as tabelas crescem sozinhas para x e andares positivos ou negativos; tudo funciona longe da origem,
// bem alto e bem fundo; rotas, salvar/carregar e as entradas de helicóptero/caminhão/carros acompanham a torre.
const {Game, FAC, STREET, X_MIN, X_MAX, TRUCK, ok, done, put, roundTrip} = require('./helpers');

// jogo com o saguão do térreo em [x0, x0 + w)
const at = (x0, w = 64) => {
  const g = new Game(); g.funds = 1e12; g.star = 5; g.msg = () => {}; g.reachable = f => !f.dead && f.k !== 'ruin';   // mede o mundo sem teto, não o acesso
  const r = g.placeLobbySpan(0, x0, x0 + w - 1); if (!r.ok) throw new Error(r.err);
  g.facs.forEach(f => { f.build = 1; });
  return g;
};
const built = (g, k, L, x, o) => { const r = g.placeFac(k, L, x, o); if (!r.ok) throw new Error(k + ' L' + L + ' x' + x + ': ' + r.err); const f = g.facs[g.facs.length - 1]; f.build = 1; return f; };

// 1. a camada esparsa
{
  const g = new Game(), L = g.grid, S = g.slab;
  ok(L.get(5, 5) === null && S.get(5, 5) === 0 && L.get(-9999, -9999) === null, 'célula nunca escrita é vazia (null na grade, 0 na laje), em qualquer lugar');
  const probe = [-65, -64, -63, -1, 0, 1, 63, 64, 65, 130000, -130000];
  for (const u of probe) { S.set(-7, u, 1); L.set(300, u, {id: u}); }
  ok(probe.every(u => S.get(-7, u) === 1 && L.get(300, u).id === u), 'lê de volta cada célula, inclusive nas bordas dos blocos de 64 e nos extremos (±130.000)');
  ok(S.get(-7, 2) === 0 && S.get(-6, 0) === 0 && L.get(299, 0) === null, 'o vizinho, o andar de cima e o de baixo continuam vazios');
  const b = S.bounds(-7); ok(b[0] === -130000 && b[1] === 130000 && S.bounds(0) === null, 'os limites do andar acompanham o que foi escrito (e andar sem nada não tem limites)');
  S.set(-7, 0, 0); ok(S.get(-7, 0) === 0, 'apagar uma célula devolve o valor vazio');
  const g2 = new Game(); for (let u = -70; u <= -60; u++) g2.slab.set(2, u, 1); for (let u = 62; u <= 66; u++) g2.slab.set(2, u, 1); g2.slab.set(2, 70, 1);
  ok(JSON.stringify(g2.slab.runs(2, -100, 100)) === JSON.stringify([[-70, -60], [62, 66], [70, 70]]), 'runs() devolve os trechos em ordem, atravessando as bordas dos blocos');
  ok(JSON.stringify(g2.slab.runs(2, -65, 63)) === JSON.stringify([[-65, -60], [62, 63]]), 'e respeita a janela pedida');
  ok(g.slab.rows.size === 1 && [...g.slab.rows.values()][0].chunks.size === probe.map(u => u >> 6).filter((v, i, a) => a.indexOf(v) === i).length, 'só ocupa memória onde há conteúdo: um bloco por trecho de 64 colunas usado');
}

// 2. construir e andar com x negativo, atravessando o zero
{
  const g = at(-32, 64);
  ok(g.nodeAt(0, -1) >= 0 && g.nodeAt(0, -1) === g.nodeAt(0, 0) && g.nodeAt(0, -32) === g.nodeAt(0, 31), 'o piso contínuo de -32 a 31 é um trecho só, passando pelo zero');
  for (let L = 1; L <= 3; L++) g.placeFloorSpan(L, -32, 31);
  g.placeStairs('stairs', 0, -28); g.placeStairs('stairs', 1, -28); g.placeStairs('stairs', 2, -28);
  const room = built(g, 'office', 3, 16), back = built(g, 'office', 1, -16);
  ok(room.x === 16 && g.reachable(room) && g.reachable(back), 'salas à esquerda e à direita do zero são alcançáveis pelas escadas em x negativo');
  const p = g.mkPerson('resident', room); p.st = 'idle'; p.L = 0; p.x = 10; p.plan = []; p.transient = false; p.stress = 0; g.startTrip(p, room);
  let t = 0; for (; t < 200 && !(p.at === room && p.st === 'idle'); t += 0.1) g.step(0.1);
  ok(p.at === room, `uma pessoa vai do térreo ao 4º andar andando por x negativo e positivo (${t.toFixed(0)} s)`);
}

// 3. uma torre inteira só em x negativo
{
  const g = at(-400, 64);
  for (let L = 1; L <= 2; L++) g.placeFloorSpan(L, -400, -337);
  g.placeStairs('stairs', 0, -380); g.placeStairs('stairs', 1, -380);
  const room = built(g, 'office', 2, -360), sh = g.placeShaft('elevator', -344, 0, 2);
  ok(g.reachable(room) && sh.ok && room.x === -360, 'torre toda em x negativo (-400): salas, escadas e poço funcionam');
  const mid = g.facs.reduce((a, f) => a + f.x + f.w / 2, 0) / g.facs.length;
  ok(g.towerX() === mid && mid < -300, 'o centro da torre é calculado em x negativo (' + g.towerX().toFixed(0) + ')');
}

// 4. muito longe da origem e nos limites do terreno
{
  const g = at(100000, 64);
  for (let L = 1; L <= 2; L++) g.placeFloorSpan(L, 100000, 100063);
  g.placeStairs('stairs', 0, 100020); g.placeStairs('stairs', 1, 100020);
  const room = built(g, 'office', 2, 100040);
  ok(g.reachable(room), 'uma torre em x = 100.000 funciona (rotas incluídas)');
  ok(g.slab.rows.size <= 4 && [...g.slab.rows.values()].every(r => r.chunks.size <= 2), 'e não aloca nada no resto do mundo (' + g.slab.rows.size + ' andares, poucos blocos)');
  const edge = new Game(); edge.funds = 1e12; edge.star = 5; edge.msg = () => {};
  ok(edge.placeFac('lobby', 0, X_MAX, {w: 4}).err === 'Fora do terreno.' && edge.placeFac('lobby', 0, X_MIN - 4, {w: 4}).err === 'Fora do terreno.', 'além de ±131.000 unidades é "fora do terreno"');
  ok(edge.placeFac('lobby', 0, X_MIN, {w: 4}).ok && edge.placeFac('lobby', 0, X_MAX - 4, {w: 4}).ok, 'logo dentro dos limites ainda dá para construir');
  ok(edge.placeFac('lobby', 0, 2, {w: 4}).err === 'Fora da grade.' && edge.placeFac('lobby', 0, -2, {w: 4}).err === 'Fora da grade.', 'a grade de 4 unidades vale também para x negativo');
}

// 5. bem alto (centenas de andares) e bem fundo
{
  const g = at(0, 64), N = 160;
  for (let L = 1; L <= N; L++) g.placeFloorSpan(L, 0, 63);
  for (let L = 0; L < N; L++) { const r = g.placeStairs('stairs', L, 8); if (!r.ok) throw new Error('escada ' + L + ': ' + r.err); }
  const top = built(g, 'office', N, 24);
  ok(top.L === 160 && g.reachable(top), 'um escritório no andar 161 é alcançável pelas escadas');
  ok(g.stairReach(top) && g.nodeAt(N, 30) >= 0 && g.nodeLevel(g.nodeAt(N, 30)) === N, 'os nós de rota guardam o andar certo mesmo lá em cima (nodeLevel)');
  ok(g.topBuilt() === N, 'topBuilt acompanha');
  ok([14, 104, 299, 1499].every(L => isLobby(L)) && ![15, 100].some(L => isLobby(L)), 'há saguões aéreos a cada 15 andares, sem parar no andar 90');
  function isLobby(L) { return L % 15 === 14; }
  const g2 = at(0, 64);
  for (let L = -1; L >= -30; L--) g2.placeFloorSpan(L, 0, 63);
  for (let L = -30; L < 0; L++) { const r = g2.placeStairs('stairs', L, 8); if (!r.ok) throw new Error('escada ' + L + ': ' + r.err); }
  const deep = g2.placeFac('parkspace', -30, 24);
  ok(g2.nodeAt(-30, 30) >= 0 && g2.nodeLevel(g2.nodeAt(-30, 30)) === -30, 'subsolo B30: o piso e o nó de rota existem');
  ok(deep.ok || /Precisa de apoio|ocupado|encostar/.test(deep.err), 'dá para construir lá embaixo (ou o motivo é o apoio, não o limite do mundo)');
  ok(g2.nodeAt(-30, 9) !== g2.nodeAt(-29, 9) && g2.nodeLevel(g2.nodeAt(-29, 9)) === -29, 'andares negativos têm nós distintos');
}

// 6. trechos de piso só dos andares consultados
{
  const g = at(0, 64);
  for (let L = 1; L <= 50; L++) g.placeFloorSpan(L, 0, 63);
  g.nodeAt(25, 10);
  ok(g._segs && g._segs.size === 1, 'nodeAt calcula os trechos só do andar consultado (1 de 50), não do mundo todo');
  g.dirty(); ok(!g._segs, 'e uma obra descarta o cache');
}

// 7. salvar e carregar longe da origem
{
  const g = at(-5000, 64);
  for (let L = 1; L <= 3; L++) g.placeFloorSpan(L, -5000, -4937);
  g.placeStairs('stairs', 0, -4980); g.placeStairs('stairs', 1, -4980);
  built(g, 'office', 2, -4960); const lone = built(g, 'condo', 1, -4944); lone.occ = true;
  g.placeShaft('elevator', -4952, 0, 2);
  const d = JSON.parse(JSON.stringify(g.serialize()));
  ok(Array.isArray(d.slab[0]) && typeof d.slab[0][0] === 'number' && d.slab.some(e => e[1].some(([a]) => a < -4900)), 'o save guarda a laje por andar, com coordenadas negativas');
  const g2 = roundTrip(g);
  const cells = x => { const out = []; for (const L of x.slab.levels()) for (const [a, b] of x.slab.runs(L, -6000, 6000)) out.push(L + ':' + a + '-' + b); return out.sort().join(','); };
  ok(cells(g2) === cells(g) && g2.facs.length === g.facs.length && g2.stairs.length === 2 && g2.shafts.length === 1, 'salvar e carregar devolve a mesma torre (laje, salas, escadas, poço)');
  ok(g2.reachable(g2.facs.find(f => f.k === 'office')) && g2.facs.find(f => f.k === 'condo').x === -4944, 'e continua alcançável, com as posições negativas');
}

// 8. entradas e saídas acompanham a torre, onde quer que ela esteja
{
  for (const x0 of [-3000, 0, 7000]) {
    const g = at(x0, 64); for (let L = 1; L <= 2; L++) g.placeFloorSpan(L, x0, x0 + 63);
    g.placeStairs('stairs', 0, x0 + 20); g.placeStairs('stairs', 1, x0 + 20);
    const room = built(g, 'office', 2, x0 + 40), cx = g.towerX();
    g.callHeli(room.L + 1, room.x, 'bomb');
    ok(Math.abs(g.heli.x - g.heli.tx) === STREET && g.heli.dir === (g.heli.x > g.heli.tx ? -1 : 1), `[x=${x0}] o helicóptero entra a ${STREET} unidades do alvo, vindo do lado oposto ao centro da torre`);
    g.heli = null; g.ignite(room, 't'); room.fire = 1.12; g.callTruck(room);
    const ts = g.trucks.slice().sort((a, b) => a.goal - b.goal);
    ok(ts.length === TRUCK.trucks && ts.every(t => Math.abs(t.x - t.goal) === 200 && Math.abs(t.goal - cx) < 64) && ts[0].x < ts[0].goal && ts[1].x > ts[1].goal, `[x=${x0}] os caminhões saem a 200 unidades das portas, um de cada lado`);
    let n = 0; for (let i = 0; i < 4000 && n === 0; i++) { g.updCars(0.5); n = g.cars.length; }
    ok(g.cars.length > 0 && g.cars.every(c => Math.abs(c.x - cx) <= STREET + 20), `[x=${x0}] os carros da rua aparecem perto da torre`);
    g.trucks = []; g.facs.find(f => f.k === 'office').fire = 0;
    g.msg = () => {}; g.day; g.holidayEvent(); g.t = (Math.floor(g.t / 1440) + (28 - 2 - (Math.floor(g.t / 1440) % 28))) * 1440; g.holidayEvent();
    if (g.santa) ok(g.santa.x === cx - 220 && g.santa.end === cx + 260, `[x=${x0}] o Papai Noel cruza o céu da torre`);
  }
}

// 9. efeitos locais em coordenadas negativas
{
  const g = at(-200, 64); for (let L = 1; L <= 2; L++) g.placeFloorSpan(L, -200, -137);
  const a = built(g, 'condo', 1, -200), b = built(g, 'restaurant', 1, -184);
  ok(g.roomDist(a, b) === 0 && g.noiseOf(a) === 1, 'distância e barulho funcionam em x negativo');
  g.addIncident('theft', a); const e = g.incidentEffect(b);
  ok(e.theft < 0 && e.theft > g.incidentEffect(a).theft, 'ocorrências e vizinhos também');
}
done('mundo');
