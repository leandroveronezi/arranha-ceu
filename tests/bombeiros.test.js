'use strict';
// Fase 2 e D: corredor com hidrante e bombeiros que sobem a pé, só por escadas e escadas rolantes.
const {FAC, TRUCK, ok, done, mk, put, person, roundTrip, UTIL} = require('./helpers');
// torres altas: o alcance da energia e da água não é o assunto aqui (rede.test.js cobre)
UTIL.reach.grid = 1e6;

// prédio com piso de 0 a 31 em cada andar e uma cadeia de escadas (ou escadas rolantes) do térreo até o andar n; sala em chamas no andar n com hidrante ao lado
const tower = (n, kind = 'stairs', opt = {}) => {
  const g = mk();
  for (let L = 1; L <= n; L++) { const r = g.placeFloorSpan(L, 0, 31); if (!r.ok) throw new Error('piso ' + L + ': ' + r.err); }
  if (kind) for (let L = 0; L < n; L++) { const r = g.placeStairs(kind, L, 0); if (!r.ok) throw new Error('escada ' + L + ': ' + r.err); }
  if (opt.hydrant !== false) put(g, 'corridorHyd', n, 12);
  const room = put(g, 'office', n, 16);
  return {g, room};
};
const run = (g, secs, each) => { for (let t = 0; t < secs; t += 0.1) { g.step(0.1); if (each && each(t)) break; } };
const crew = g => g.people.filter(p => !p.dead && p.kind === 'firefighter');

// dados
{
  ok(FAC.corridorHyd && FAC.corridorHyd.corr === 'hyd' && FAC.corridorHyd.struct, 'corredor com hidrante existe e não queima');
  const g = mk(); put(g, 'corridorHyd', 1, 8); const r = put(g, 'office', 1, 12), far = put(g, 'office', 1, 40); put(g, 'office', 1, 0);
  ok(g.corrNear(r, 'hyd') && !g.corrNear(far, 'hyd'), 'hidrante cobre só o alcance do corredor');
  g.star = 1; ok(!!g.canPlaceFac('corridorHyd', 1, 20).err, 'hidrante exige 2 estrelas');
}

// alcance: só escadas e escadas rolantes valem
{
  const {g, room} = tower(5);
  ok(g.stairReach(room) === true, 'com escadas do térreo até o andar, os bombeiros chegam');
  const t2 = tower(5, 'escalator'); ok(t2.g.stairReach(t2.room) === true, 'escadas rolantes valem como escada');
  const t3 = tower(5, null); ok(t3.g.stairReach(t3.room) === false, 'sem escada nenhuma, não chegam');
  const t4 = tower(5, null); const sh = t4.g.placeShaft('elevator', 32, 0, 5); ok(sh.ok && t4.g.stairReach(t4.room) === false, 'só elevador não vale para os bombeiros');
  const t5 = tower(5); t5.g.bulldoze(2, 1); t5.g.bulldoze(2, 1); ok(t5.g.stairReach(t5.room) === false, 'escada quebrada no meio do caminho: não chegam (cache refeito)');
  const f = g.fireRisk().factors; ok(f.some(x => /sobem só por escadas/.test(x)), 'painel de risco avisa que sobem só por escadas');
  const t6 = tower(5, null); ok(t6.g.fireRisk().factors.some(x => /sem escada até lá/.test(x)), 'painel de risco conta salas com hidrante sem escada');
}

// chamada
{
  const {g, room} = tower(5); g.ignite(room, 't'); room.fire = TRUCK.callAt + 0.01; g.step(0.1);
  ok(g.trucks.length === TRUCK.trucks && room.truck, `fogo acima do limite em sala coberta e com escada chama ${TRUCK.trucks} caminhões`);
  const xs = g.trucks.map(t => t.goal).sort((a, b) => a - b), from = g.trucks.slice().sort((a, b) => a.goal - b.goal).map(t => t.dir);
  ok(xs[0] < xs[1] && from[0] === 1 && from[1] === -1, `um caminhão de cada lado do prédio (portas ${xs.map(x => x.toFixed(1)).join(' e ')}; o da esquerda vem da esquerda, o da direita da direita)`);
  const n = tower(5, null); n.g.ignite(n.room, 't'); n.room.fire = 1.2; n.g.step(0.1);
  ok(n.g.trucks.length === 0, 'com hidrante mas sem escada, o caminhão não é chamado');
  n.room.fire = 1.35; n.g.step(0.1);
  ok(!!n.g.heli, 'sem escada, o helicóptero é a saída');
  const s = tower(5, 'stairs', {hydrant: false}); s.g.ignite(s.room, 't'); s.room.fire = 1.2; s.g.step(0.1);
  ok(s.g.trucks.length === 0, 'sem hidrante, o caminhão não é chamado');
  const m = tower(5); m.g.funds = TRUCK.cost - 1; m.g.ignite(m.room, 't'); m.room.fire = 1.2; m.g.step(0.1);
  ok(m.g.trucks.length === 0, 'sem dinheiro, o caminhão não é chamado');
  const p = tower(5); p.g.ignite(p.room, 't'); p.room.fire = 1.05; p.g.step(0.1);
  ok(p.g.trucks.length === 0, 'fogo ainda pequeno: ninguém é chamado');
}

// do caminhão ao incêndio apagado: a equipe sobe a pé pelas escadas e volta
for (const kind of ['stairs', 'escalator']) {
  const {g, room} = tower(5, kind); const f0 = g.funds;
  const sh = g.placeShaft('elevator', 40, 0, 5); if (!sh.ok) throw new Error(sh.err);   // elevador disponível, mas eles não podem usar
  g.ignite(room, 't'); room.fire = 1.12;
  let maxL = 0, states = new Set(), seen = 0, truckAtDoor = false, outAt = null;
  run(g, 120, t => {
    for (const p of crew(g)) { seen = Math.max(seen, crew(g).length); maxL = Math.max(maxL, Math.round(p.L)); states.add(p.st); }
    if (g.trucks[0] && g.trucks[0].phase === 'work') truckAtDoor = true;
    if (outAt === null && !room.fire) outAt = t;
    return outAt !== null && !g.trucks.length && !crew(g).length;
  });
  ok(truckAtDoor && seen === TRUCK.crew * TRUCK.trucks, `[${kind}] os caminhões chegam e as equipes descem (${seen} bombeiros)`);
  ok(maxL === 5, `[${kind}] a equipe sobe até o andar da sala (máximo ${maxL})`);
  ok(!states.has('wait') && !states.has('ride'), `[${kind}] ninguém pega elevador (estados: ${[...states].join(', ')})`);
  ok(states.has('stair'), `[${kind}] a subida é pela escada`);
  ok(!room.fire && g.facs.includes(room) && !room.dead, `[${kind}] o fogo apaga antes de queimar a sala`);
  ok(g.fin.cur.mnt.brigade === TRUCK.cost, `[${kind}] o gasto entra em "Bombeiros": ${g.fin.cur.mnt.brigade}`);
  ok(g.trucks.length === 0 && crew(g).length === 0 && !room.truck, `[${kind}] depois os caminhões vão embora e as equipes somem do prédio`);
  ok(!g.people.some(p => p.kind === 'firefighter' && !p.dead), `[${kind}] sem bombeiros sobrando em lugar nenhum`);
}

// andar alto demais: o helicóptero entra como reforço
{
  const {g, room} = tower(30); g.ignite(room, 't'); room.fire = 1.12; let heli = false, truck = false;
  run(g, 200, t => { if (g.heli) heli = true; if (g.trucks.length) truck = true; return !room.fire; });
  ok(truck && heli, 'andar 31: o caminhão sai, mas o fogo passa de ' + TRUCK.backup + ' e o helicóptero vem de reforço');
  ok(g.facs.includes(room) && !room.fire, 'o reforço salva a sala');
}

// porta única: os dois caminhões ficam um de cada lado dela
{
  const {g, room} = tower(3); g.groundEntrances = () => [{x: 2.5, key: 0}]; g.callTruck(room);
  const t = g.trucks.slice().sort((a, b) => a.goal - b.goal);
  ok(t.length === 2 && t[0].door === 2.5 && t[1].door === 2.5 && t[0].goal < 2.5 && t[1].goal > 2.5 && t[0].dir === 1 && t[1].dir === -1, 'só uma porta: os dois caminhões estacionam um de cada lado dela');
}

// o fogo é apagado uma só vez e o gasto também, mesmo com várias equipes
{
  const {g, room} = tower(3); g.ignite(room, 't'); room.fire = 1.12; const f0 = g.funds;
  run(g, 120, () => !room.fire && !g.trucks.length && !crew(g).length);
  ok(f0 - g.funds === TRUCK.cost && !g.trucks.length && !crew(g).length && !room.truck, 'várias equipes: um gasto só, todos voltam e os dois caminhões saem');
}

// se o fogo apagar sozinho a equipe volta sem cobrar
{
  const {g, room} = tower(3); g.ignite(room, 't'); room.fire = 1.12; const f0 = g.funds;
  g.step(0.1); room.fire = 0; room.truck = true;
  run(g, 120, () => !g.trucks.length && !crew(g).length);
  ok(g.funds === f0 && !room.truck && g.trucks.length === 0, 'fogo já apagado: os bombeiros voltam sem cobrar');
}

// sala destruída com a equipe a caminho
{
  const {g, room} = tower(3); g.ignite(room, 't'); room.fire = 1.12; g.step(0.1); const f0 = g.funds;
  run(g, 6, () => false);
  g.burn(room);
  run(g, 120, () => !g.trucks.length && !crew(g).length);
  ok(g.trucks.length === 0 && crew(g).length === 0 && g.funds === f0, 'sala destruída: a equipe desiste, volta e não cobra');
}

// salvar e carregar
{
  const {g, room} = tower(5); g.ignite(room, 't'); room.fire = 1.12; g.step(0.1); g.updTrucks(2);
  const g2 = roundTrip(g), t = g2.trucks[0];
  ok(g2.trucks.length === TRUCK.trucks && t.phase === 'drive' && t.fac.truck && g2.trucks.every(x => x.door !== undefined), 'caminhões em viagem sobrevivem a salvar e carregar');
  const g3 = (() => { const {g: h, room: r} = tower(5); h.ignite(r, 't'); r.fire = 1.12; h.callTruck(r); h.updTrucks(TRUCK.eta + 1); return h; })();
  ok(g3.trucks.every(t => t.phase === 'work') && crew(g3).length === TRUCK.crew * TRUCK.trucks, 'caminhões estacionados têm as equipes fora');
  const d = g3.serialize(); ok(!d.people.some(p => p.kind === 'firefighter') && !JSON.stringify(d).includes('"crew"'), 'equipe e caminhão estacionado não vão para o save');
  const g4 = new (g3.constructor)(); g4.msg = () => {}; g4.load(JSON.parse(JSON.stringify(d)));
  ok(g4.trucks.length === 0 && !g4.facs.find(f => f.k === 'office').truck, 'ao carregar, o chamado é desfeito e o incêndio pode chamar de novo');
}
done('bombeiros');
