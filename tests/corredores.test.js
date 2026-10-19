'use strict';
// Fase 1: corredores, extintor, sprinklers, demolição bloqueada e reconstrução de ruínas.
const {FAC, CORR, ok, done, mk, put, roundTrip} = require('./helpers');

// espalhamento através de corredores
{
  const g = mk(), a = put(g, 'office', 1, 0); put(g, 'corridor', 1, 8); const b = put(g, 'office', 1, 12);
  const t = g.spreadTargets(a);
  ok(t.length === 1 && t[0][0] === b && t[0][1] === CORR.spreadPlain, 'fogo passa pelo corredor simples com 25% da chance');
  const g2 = mk(), a2 = put(g2, 'office', 1, 0); put(g2, 'corridorSpr', 1, 8); put(g2, 'office', 1, 12);
  ok(g2.spreadTargets(a2)[0][1] === CORR.spreadSpr, 'fogo passa pelo corredor com sprinklers com 5%');
  const g3 = mk(), a3 = put(g3, 'office', 1, 0); put(g3, 'office', 1, 8);
  ok(g3.spreadTargets(a3)[0][1] === 1, 'vizinho direto: 100%');
  const g4 = mk(); const base = put(g4, 'office', 1, 0); put(g4, 'corridor', 2, 0); const up = put(g4, 'office', 3, 0);
  ok(g4.spreadTargets(base)[0][0] === up, 'espalhamento vertical atravessa o corredor');
}

// cobertura do extintor
{
  const g = mk(), e = put(g, 'corridorExt', 1, 24);
  const near = put(g, 'office', 1, 8), far = put(g, 'office', 1, 0); put(g, 'office', 1, 28);
  const up = put(g, 'office', 2, 28), up2 = put(g, 'office', 3, 24);
  ok(g.corrCovers(e, near), 'cobre sala a 12 unidades');
  ok(!g.corrCovers(e, far), 'não cobre sala além do alcance');
  ok(g.corrCovers(e, up), 'cobre o andar de cima');
  ok(!g.corrCovers(e, up2), 'não cobre 2 andares acima');
  ok(g.fireRisk().factors.some(x => /cobertas por extintor/.test(x)), 'painel de risco mostra a cobertura de extintores');
}

// extintor: alguém vai a pé até o corredor; custa recarga e pode falhar
const withExt = () => {
  const g = mk(); g.updPerson0 = undefined;
  const nb = put(g, 'office', 1, 0), ext = put(g, 'corridorExt', 1, 8), burn = put(g, 'office', 1, 12);
  const p = g.mkPerson('resident', nb); g.placeIn(p, nb);
  return {g, nb, ext, burn, p};
};
{
  const {g, ext, burn, p} = withExt(); g.ignite(burn, 't'); g.tryExtinguish(burn, 100);
  ok(p.extinguish && p.extinguish.c === ext && p.dest && p.dest.fac === ext && p.st === 'walk', 'o morador da sala vizinha sai andando até o extintor');
  ok(burn.extBy === p, 'a sala sabe quem está indo');
  const x0 = p.x; g.step(0.1);
  ok(!burn.fire === false && g.fxs.length === 0, 'a caminho: ainda não apagou nada nem custa recarga');
  g.tryExtinguish(burn, 100); ok(burn.extBy === p, 'com alguém a caminho, ninguém mais é mandado');
  let t = 0; for (; t < 40 && !g.fxs.length; t += 0.1) g.step(0.1);
  ok(g.fxs.length === 1 && g.fxs[0].k === 'ext' && g.fxs[0].from === ext && p.x > x0 && p.at === ext, `ao chegar ao corredor ele usa o extintor (${t.toFixed(1)} s depois, saindo do x=${x0.toFixed(1)})`);
  ok(p.fxUntil > g.simT && !p.extinguish && !burn.extBy, 'a pessoa real some do desenho enquanto o efeito faz o papel dela');
  ok(g.fin.cur.mnt.refills === CORR.extRefill, 'a recarga é cobrada na hora de usar');
}
{
  let wins = 0, cost = 0; const N = 600;
  for (let i = 0; i < N; i++) {
    const {g, ext, burn, p} = withExt(); g.ignite(burn, 't'); p.extinguish = {f: burn, c: ext};
    const f0 = g.funds; g.useExtinguisher(p); if (!burn.fire) wins++; cost += f0 - g.funds;
  }
  ok(Math.abs(wins / N - CORR.extChance) < 0.1, 'taxa de sucesso próxima de ' + CORR.extChance + ': ' + (wins / N).toFixed(2));
  ok(Math.abs(cost / N - CORR.extRefill) < 1, 'cada uso custa a recarga, inclusive os que falham');
  const a = withExt(); a.g.ignite(a.burn, 't'); a.burn.fire = 1.4; a.p.extinguish = {f: a.burn, c: a.ext}; const f0 = a.g.funds; a.g.useExtinguisher(a.p);
  ok(a.burn.fire === 1.4 && a.g.funds === f0 && !a.g.fxs.length, 'fogo que passou de 1,3 antes de ele chegar: viagem em vão, nada é cobrado');
  const b = withExt(); b.g.ignite(b.burn, 't'); b.burn.fire = 0; b.p.extinguish = {f: b.burn, c: b.ext}; const f1 = b.g.funds; b.g.useExtinguisher(b.p);
  ok(b.g.funds === f1, 'fogo que já apagou: nada é cobrado');
  const c = withExt(); c.g.people.length = 0; c.g.ignite(c.burn, 't'); const f2 = c.g.funds; c.g.tryExtinguish(c.burn, 100);
  ok(c.burn.fire === 1 && c.g.funds === f2 && !c.burn.extBy, 'sem ninguém por perto: nada acontece nem custa');
  const d = withExt(); d.g.people.length = 0; d.g.ignite(d.burn, 't'); const q = d.g.mkPerson('resident', d.burn); d.g.placeIn(q, d.burn); d.g.tryExtinguish(d.burn, 100);
  ok(!d.burn.extBy, 'quem está na própria sala em chamas não conta');
  const e = withExt(); e.g.t = 0; e.g.ignite(e.burn, 't'); e.p.st = 'walk'; e.g.tryExtinguish(e.burn, 100);
  ok(!e.burn.extBy, 'só quem está ocioso é chamado');
}

// acima de 1,3 o extintor não é nem tentado; sprinklers deixam o fogo crescer mais devagar
{
  const {g, burn, p} = withExt(); g.ignite(burn, 't'); burn.fire = 1.4; const f0 = g.funds; g.step(0.1);
  ok(burn.fire > 1.3 && !burn.extBy && p.st === 'idle' && g.funds === f0, 'acima de 1,3 ninguém é mandado ao extintor');
  const grow = k => { const g = mk(); g.updPerson = () => {}; if (k) put(g, k, 1, 8); const b = put(g, 'office', 1, 12); g.ignite(b, 't'); for (let i = 0; i < 50; i++) g.step(0.1); return b.fire; };
  const a = grow(null), s = grow('corridorSpr');
  ok(s - 1 < (a - 1) * 0.75, `corredor com sprinklers desacelera o fogo (${a.toFixed(3)} contra ${s.toFixed(3)})`);
}

// demolição
{
  const g = mk(), b = put(g, 'office', 1, 12); g.ignite(b, 't');
  const r = g.bulldoze(1, 12);
  ok(r.err && g.facs.includes(b), 'demolir sala em chamas é bloqueado');
  b.fire = 0;
  ok(g.bulldoze(1, 12).ok, 'demolir sala sem fogo funciona');
}

// ruína e reconstrução
{
  const g = mk(), b = put(g, 'restaurant', 1, 12); g.burn(b);
  const ruins = g.facs.filter(f => f.k === 'ruin');
  ok(ruins.length === 6 && ruins.every(r => r.was && r.was.k === 'restaurant'), 'ruínas guardam o tipo original');
  const cost = g.rebuildCost(ruins[0]);
  ok(cost === Math.round(FAC.restaurant.cost * CORR.rebuildMult), 'reconstrução custa ' + CORR.rebuildMult * 100 + '% do original');
  const r2 = roundTrip(g).facs.filter(f => f.k === 'ruin');
  ok(r2.length === 6 && r2[0].was.k === 'restaurant', 'ruína sobrevive a salvar e carregar');
  const f1 = g.funds;
  ok(g.rebuild(ruins[2]) === null && f1 - g.funds === cost, 'reconstruir cobra o valor combinado');
  ok(g.facs.some(f => f.k === 'restaurant') && !g.facs.some(f => f.k === 'ruin'), 'a sala volta e as ruínas somem');
  const g3 = mk(); put(g3, 'office', 1, 0); const c = put(g3, 'cinema', 1, 12); g3.burn(c); g3.placeFac('office', 2, 12);
  const n0 = g3.facs.filter(f => f.k === 'ruin').length, e = g3.rebuild(g3.facs.find(f => f.k === 'ruin'));
  ok(e && g3.facs.filter(f => f.k === 'ruin').length === n0, 'se o espaço estiver ocupado, as ruínas voltam como estavam');
}

// salvar e carregar os corredores
{
  const g = mk(); put(g, 'corridor', 1, 0); put(g, 'corridorExt', 1, 4); put(g, 'corridorSpr', 1, 8); put(g, 'corridorHyd', 1, 12);
  const g2 = roundTrip(g);
  ok(['corridor', 'corridorExt', 'corridorSpr', 'corridorHyd'].every(k => g2.facs.some(f => f.k === k)), 'corredores salvam e carregam');
}
done('corredores');
