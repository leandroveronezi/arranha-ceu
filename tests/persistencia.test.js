'use strict';
// F5 não pode apagar estado: vagas ocupadas, fogo, obra, fila, velocidade e tudo o mais que o jogo guarda em cada item.
const {FAC, ok, done, mk, put, roundTrip} = require('./helpers');

const torre = () => {
  const g = mk(160);
  for (let L = 1; L <= 4; L++) g.placeFloorSpan(L, 0, 159);
  g.placeFloorSpan(-1, 0, 159);
  for (let L = -1; L < 4; L++) g.placeStairs('stairs', L, 148);
  g.facs.forEach(f => { f.build = 1; });
  put(g, 'parkramp', -1, 0, {dir: -1});   // a ponta baixa (a ligada às vagas) fica à direita
  for (let i = 0; i < 6; i++) put(g, 'parkspace', -1, FAC.parkramp.w + i * FAC.parkspace.w);
  const off = put(g, 'office', 1, 0); off.occ = true; g.moveIn(off);
  g.calcStats();
  return g;
};

// vaga ocupada continua ocupada, com o mesmo dono, e quem chegou de carro sai pela vaga
{
  const g = torre();
  const off = g.facs.find(f => f.k === 'office'), p = off.persons[0];
  const sp = g.facs.filter(f => f.k === 'parkspace')[0];
  p.st = 'away'; p.at = null;
  const e = {type: 'car', L: sp.L, x: sp.x + 2, key: g.nodeAt(sp.L, sp.x + 2), space: sp};
  g.chooseEntry = () => e;
  g.startTrip(p, off);
  ok(sp.owner === p && p.via && p.via.type === 'car', 'preparo: a pessoa estacionou na vaga');
  const g2 = roundTrip(g), sp2 = g2.facs.filter(f => f.k === 'parkspace')[0];
  ok(sp2.owner && sp2.owner.via && sp2.owner.via.space === sp2, 'vaga ocupada continua ocupada depois de salvar e carregar');
  ok(sp2.carCol === sp.carCol, 'a cor do carro na vaga é a mesma');
  ok(g2.facs.filter(f => f.k === 'parkspace' && f.owner).length === 1, 'só a vaga certa fica ocupada');
  const q = sp2.owner; g2.startExit(q);
  ok(q.dest && q.dest.exit && q.dest.L === sp2.L, 'ao sair, o dono volta para o carro (mesma vaga)');
  const g3 = roundTrip(g2);
  ok(g3.facs.filter(f => f.k === 'parkspace' && f.owner).length === 1, 'salvar duas vezes mantém a vaga');
}

// metrô, ponto e rua: a forma de entrar sobrevive
{
  const g = torre(), off = g.facs.find(f => f.k === 'office'), p = off.persons[0];
  p.st = 'idle'; p.at = off; p.L = 1; p.x = 3; p.via = {type: 'ground', L: 0, x: 40};
  const g2 = roundTrip(g), q = g2.facs.find(f => f.k === 'office').persons[0];
  ok(q.via && q.via.type === 'ground' && q.via.x === 40, 'entrada pela rua é lembrada');
}

// estado de cada sala
{
  const g = torre(), off = g.facs.find(f => f.k === 'office'), sp = g.facs.find(f => f.k === 'parkspace');
  off.fire = 1.2; off.fireCause = 'Curto-circuito'; off.spread = true; off.heliCalled = true; off.truckT = g.t + 20; off.trend = -3.5; off.eval = 77; off.bomb = 1; off.dirty = true; off.bugs = 2; off.closed = true; off.closeWhy = 'x';
  const u = put(g, 'office', 2, 0); u.build = 0.4;
  g.speed = 3; g.pendingHeli = [{t: g.t + 10, L: 3, x: 20}]; g.log.unshift({text: 'oi', t: g.t});
  sp.rush = 2.5;
  const g2 = roundTrip(g), o2 = g2.facs.find(f => f.k === 'office' && f.L === 1), u2 = g2.facs.find(f => f.k === 'office' && f.L === 2);
  ok(o2.fire === 1.2 && o2.fireCause === 'Curto-circuito' && o2.spread && o2.heliCalled, 'fogo, causa, propagação e helicóptero chamado');
  ok(o2.truckT > g2.t && o2.trend === -3.5 && o2.eval === 77 && o2.bomb && o2.dirty && o2.bugs === 2 && o2.closed && o2.closeWhy === 'x', 'caminhão em espera, tendência, nota, bomba, sujeira, pragas e fechamento');
  ok(u2.build === 0.4, 'obra em andamento mantém o progresso');
  ok(g2.speed === 3 && g2.pendingHeli && g2.pendingHeli.length === 1 && g2.log[0].text === 'oi', 'velocidade, helicóptero agendado e registro de avisos');
  ok(g2.facs.find(f => f.k === 'parkspace').rush === 2.5, 'fila do ponto/vaga');
}

done('persistencia');
