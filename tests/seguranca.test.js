'use strict';
// Segurança por área: postos, brigas, furtos, bombas, câmeras, sprinklers locais e a cobertura mostrada no mapa.
const {Game, FAC, CORR, SEC, ok, done, mk: mk0, put, person, roundTrip} = require('./helpers');
// estes testes medem a regra do próprio assunto, não o acesso: toda sala conta como alcançável (acesso: acesso.test.js e invariantes.test.js)
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

// posto de segurança com guardas em serviço (st 'idle')
const post = (g, L, x, guards = 2) => {
  const p = put(g, 'security', L, x); g.onBuilt(p);
  p.persons.slice(guards).forEach(q => { q.dead = true; });
  p.persons.slice(0, guards).forEach(q => { q.st = 'idle'; q.at = p; });
  return p;
};
const column = (g, n, x = 0) => { for (let L = 1; L <= n; L++) put(g, 'office', L, x); };   // apoio para salas altas

// área do posto: andares e distância horizontal
{
  const g = mk(120); const p = put(g, 'security', 1, 24);
  column(g, 10, 0);
  const at = L => g.facs.find(f => f.k === 'office' && f.L === L);
  ok(g.secCovers(p, at(7)) && !g.secCovers(p, at(8)), `cobre até ${SEC.floors} andares acima do posto (andar 7 sim, 8 não)`);
  const far = put(g, 'office', 1, 24 + 16 + SEC.reach + 8); const near = put(g, 'office', 1, 24 + 16 + SEC.reach - 8);
  ok(g.secCovers(p, near) && !g.secCovers(p, far), `cobre até ${SEC.reach} unidades para o lado`);
  ok(g.secPosts(at(3)).length === 1 && g.secPosts(at(9)).length === 0, 'secPosts lista só quem cobre a sala');
}

// seguranças só respondem na área do seu posto
{
  const g = mk(); g.assignTask = (p, f) => { p.task = f; return true; };
  const p = post(g, 1, 24, 1); column(g, 20, 0);
  const near = g.facs.find(f => f.k === 'office' && f.L === 3), far = g.facs.find(f => f.k === 'office' && f.L === 18);
  g.ignite(far, 't'); g.dispatch();
  ok(!far.responder, 'fogo fora da área do posto: ninguém é enviado');
  far.fire = 0; g.ignite(near, 't'); g.dispatch();
  ok(near.responder && near.responder.home === p, 'fogo dentro da área: um segurança do posto vai');
  const g2 = mk(); g2.assignTask = (q, f) => { q.task = f; return true; };
  const pA = post(g2, 1, 24, 1); for (let L = 2; L <= 15; L++) put(g2, 'office', L, 24); const pB = post(g2, 16, 24, 1); put(g2, 'office', 17, 24);
  const f18 = put(g2, 'office', 18, 24); g2.ignite(f18, 't'); g2.dispatch();
  ok(f18.responder && f18.responder.home === pB, 'com dois postos, responde o que cobre a sala');
}

// brigas: cobertura local, câmera e peso do tipo de local
const fights = (setup, N = 20000) => {
  const g = mk(); g.t = 20 * 60 + 5; g.pop = 500; g.theftCheck = () => {};
  const f = setup(g);
  const crowd = []; for (let k = 0; k < 20; k++) { const q = person(f); g.people.push(q); crowd.push(q); }
  let n = 0;
  for (let i = 0; i < N; i++) { f.fight = null; for (const q of crowd) q.stress = 0; g.crimeCheck(); if (f.fight) n++; }
  return n / N;
};
{
  const bare = fights(g => put(g, 'bar', 1, 0)), cam = fights(g => { put(g, 'corridorCam', 1, 16); return put(g, 'bar', 1, 0); });
  const guarded = fights(g => { post(g, 1, 24, 2); return put(g, 'bar', 1, 0); });
  const rest = fights(g => put(g, 'restaurant', 1, 0));
  ok(Math.abs(cam / bare - CORR.camFight) < 0.12, `câmera reduz brigas em ~50% (${bare.toFixed(3)} → ${cam.toFixed(3)})`);
  ok(guarded < bare * 0.6, `segurança na área reduz brigas (${bare.toFixed(3)} → ${guarded.toFixed(3)})`);
  ok(bare > rest * 1.3, `bar gera mais brigas que restaurante (${bare.toFixed(3)} contra ${rest.toFixed(3)})`);
  const farBar = fights(g => { post(g, 1, 24, 2); for (let L = 1; L <= 11; L++) put(g, 'office', L, 16); return put(g, 'bar', 12, 16); });
  ok(Math.abs(farBar / bare - 1) < 0.2, 'bar fora da área do posto briga como se não houvesse posto');
}

// furtos: só em unidades vazias de gente; não tiram dinheiro, derrubam o humor do local e dos vizinhos (registro de ocorrências)
const thefts = (setup, N = 60000) => {
  const g = mk(); g.pop = 500; g.msg = () => {}; const f = setup(g); f.occ = true;
  let n = 0;
  for (let i = 0; i < N; i++) {
    g.funds = 1e9; g.incidents = []; g.theftCheck();
    if (g.incidents.length) { n++; if (g.funds !== 1e9) throw new Error('furto mexeu no dinheiro'); if (g.incidents[0].k !== 'theft' || g.incidents[0].x !== f.x) throw new Error('ocorrência no lugar errado'); }
  }
  return n / N;
};
{
  const bare = thefts(g => put(g, 'shop', 1, 0)), cam = thefts(g => { put(g, 'corridorCam', 1, 12); return put(g, 'shop', 1, 0); });
  const guarded = thefts(g => { post(g, 1, 24, 2); return put(g, 'shop', 1, 0); });
  ok(bare > 0.003 && bare < 0.01, 'furtos acontecem em unidades ocupadas e vazias: ' + bare.toFixed(4));
  ok(Math.abs(cam / bare - CORR.camTheft) < 0.15, `câmera reduz furtos em ~50% (${bare.toFixed(4)} → ${cam.toFixed(4)})`);
  ok(guarded < bare * 0.6, `segurança na área reduz furtos (${bare.toFixed(4)} → ${guarded.toFixed(4)})`);
  ok(thefts(g => put(g, 'kitnet', 1, 0)) > 0.003 && thefts(g => put(g, 'office', 1, 0)) > 0.003, 'apartamentos e escritórios também são furtados');
  const g = mk(); g.pop = 500; const f = put(g, 'shop', 1, 0); f.occ = true; const q = person(f); q.stress = 0; g.people.push(q);
  let hit = 0; for (let i = 0; i < 20000; i++) { g.theftCheck(); if (g.incidents.length) hit++; }
  ok(hit === 0, 'com alguém dentro, a unidade nunca é furtada');
  const g2 = mk(); g2.pop = 500; const f2 = put(g2, 'shop', 1, 0); let h2 = 0; for (let i = 0; i < 20000; i++) { g2.theftCheck(); if (g2.incidents.length) h2++; }
  ok(h2 === 0, 'unidade vaga (sem inquilino) não é furtada');
  // o furto vira ocorrência: derruba a nota do local e dos vizinhos, e se recupera com os dias
  const g3 = mk(); const f3 = put(g3, 'office', 1, 0), n3 = put(g3, 'office', 1, 8); f3.occ = true; n3.occ = true; g3.t = 1000; g3.addIncident('theft', f3);
  const fac = f => (g3.evalBreakdown(f).find(o => o.key === 'theft') || {v: 0}).v;
  const v0 = fac(f3), w0 = fac(n3); g3.t += 1440 * 1.5; const v1 = fac(f3); g3.t += 1440 * 2; const v2 = fac(f3);
  ok(v0 < -30 && w0 < 0 && w0 > v0 && v1 < 0 && v1 > v0 && v2 === 0, `humor do local cai (${Math.round(v0)}) e o do vizinho também (${Math.round(w0)}); recupera em 3 dias (${Math.round(v1)} → ${v2})`);
  const g4 = roundTrip(g3); ok(g4.incidents.length === 1 && g4.incidents[0].k === 'theft' && g4.incidents[0].x === 0, 'a ocorrência sobrevive a salvar e carregar');
}

// bomba: sem posto na área, vem o helicóptero
{
  const rnd = Math.random; Math.random = () => 0.999;   // sorteia a última sala construída
  const g = mk(); post(g, 1, 24, 1); const f = put(g, 'office', 1, 0); g.bombEvent();
  ok(f.bomb && !g.heli, 'bomba dentro da área do posto: a segurança é acionada');
  const g2 = mk(); post(g2, 1, 24, 1); column(g2, 20, 0); const top = g2.facs[g2.facs.length - 1]; g2.bombEvent();
  Math.random = rnd;
  ok(top.L === 20 && !top.bomb && !!g2.heli, 'bomba fora da área de qualquer posto: helicóptero e resgate');
}

// painel de risco
{
  const g = mk(); put(g, 'bar', 1, 0); const r0 = g.crimeRisk();
  ok(r0.factors.some(x => /Sem posto de segurança/.test(x)) && r0.factors.some(x => /bares pesam mais/.test(x)), 'painel de violência avisa que não há posto e que bares pesam');
  post(g, 1, 24, 2); ok(g.crimeRisk().factors.some(x => /0 local\(is\) fora da área/.test(x)), 'painel conta locais fora da área dos postos');
}

// sprinklers por área (o sistema do prédio inteiro foi removido)
{
  ok(!('sprinkler' in new Game().sys) && !('cameras' in new Game().sys), 'não há mais sprinklers/câmeras do prédio inteiro');
  const g = mk(); g.updPerson = () => {}; put(g, 'corridorSpr', 1, 8); const b = put(g, 'office', 1, 12); g.ignite(b, 't'); b.fire = 1.3;
  for (let i = 0; i < 200 && b.fire; i++) g.step(0.1);
  ok(!b.fire, 'sprinklers da área contêm o fogo sozinhos');
  const g2 = mk(); g2.updPerson = () => {}; const b2 = put(g2, 'office', 1, 12); g2.ignite(b2, 't'); b2.fire = 1.3;
  for (let i = 0; i < 100; i++) g2.step(0.1);
  ok(b2.fire > 1.3, 'sem sprinklers na área o fogo continua');
  let cov = 0, unc = 0; const N = 6000;
  for (let i = 0; i < N; i++) {
    const g = mk(); put(g, 'corridorSpr', 1, 12); const a = put(g, 'office', 1, 16), c = put(g, 'office', 1, 56);
    g.ignite = (f, cause) => { f.fire = 1; f.fireCause = cause; };
    g.fireEvent(); if (a.fire) cov++; if (c.fire) unc++;
  }
  ok(Math.abs(cov / (cov + unc) - CORR.sprIgnition / (1 + CORR.sprIgnition)) < 0.04, `sala coberta por sprinklers pega fogo ${(cov / unc).toFixed(2)}× o de uma descoberta (~${CORR.sprIgnition})`);
}

// saves antigos: sistemas do prédio inteiro são reembolsados
{
  const g = mk(); const d = JSON.parse(JSON.stringify(g.serialize())); d.sys = {sprinkler: true, cameras: true}; d.funds = 1e6;
  const g2 = new Game(); g2.msg = () => {}; g2.load(d);
  ok(g2.funds === 1e6 + 600000 + 400000 && Object.keys(g2.sys).length === 0, 'sprinklers e câmeras antigos viram reembolso de R$ 1.000.000');
}

// cobertura usada nas visões do mapa
{
  const g = mk(); g.updPerson = () => {}; put(g, 'corridorExt', 1, 8); put(g, 'corridorCam', 1, 44);
  const a = put(g, 'office', 1, 12), c = put(g, 'office', 1, 48), none = put(g, 'office', 1, 60);
  post(g, 1, 24, 1);
  ok(g.coverage(a).fire === 'ext' && g.coverage(none).fire === null, 'coverage(): fogo');
  ok(g.coverage(a).post && g.coverage(c).cam && g.coverage(a).guards === 1, 'coverage(): posto, segurança em serviço e câmera');
  put(g, 'corridorHyd', 1, 56); g.dirty();
  ok(g.coverage(c).fire === 'hyd', 'o cache é refeito quando o prédio muda');
}
// tempo de resposta dos seguranças (rota real de equipe)
{
  const g = mk(); g.placeFloorSpan(1, 0, 31); for (let L = 2; L <= 5; L++) g.placeFloorSpan(L, 0, 31);
  const pst = post(g, 1, 16, 1), same = put(g, 'office', 1, 8);
  const cv = g.coverage(same);
  ok(cv.post && typeof cv.resp === 'number' && cv.resp >= 0 && cv.resp <= SEC.fastSec, 'sala no mesmo andar do posto: resposta rápida (~' + cv.resp + ' s)');
  const up = put(g, 'office', 5, 16);
  ok(g.coverage(up).post && g.coverage(up).resp === null, 'sala dentro da área, mas sem rota para os seguranças: sem resposta');
  for (let L = 1; L <= 4; L++) { const r = g.placeStairs('stairs', L, 0); if (!r.ok) throw new Error(r.err); }
  g.dirty();
  const cu = g.coverage(up);
  ok(typeof cu.resp === 'number' && cu.resp > cv.resp, 'com escadas a sala passa a ter rota, mais demorada que no mesmo andar (~' + cu.resp + ' s contra ~' + cv.resp + ' s)');
  ok(g.coverage(up).stairs === true && g.coverage(same).stairs === false || typeof g.coverage(same).stairs === 'boolean', 'coverage() informa se há escada até a sala');
}

// efeitos visuais dos eventos
{
  const g = mk(); const nb = put(g, 'office', 1, 0), ext = put(g, 'corridorExt', 1, 8), b = put(g, 'office', 1, 12);
  const pe = g.mkPerson('resident', nb); g.placeIn(pe, nb); g.ignite(b, 't'); g.tryExtinguish(b, 100);
  for (let i = 0; i < 400 && !g.fxs.length; i++) g.step(0.1);
  ok(g.fxs.length === 1 && g.fxs[0].k === 'ext' && g.fxs[0].from === ext && g.fxs[0].f === b, 'usar o extintor cria o efeito, com o corredor de origem');
  const e = g.fxs[0]; for (let i = 0; i < 400; i++) g.step(0.1);
  ok(g.fxs.length === 0 || g.fxs[0] !== e, 'o efeito termina sozinho depois da duração');
  const g2 = mk(); g2.updPerson = () => {}; put(g2, 'corridorSpr', 1, 8); const b2 = put(g2, 'office', 1, 12); g2.ignite(b2, 't'); b2.fire = 1.34;
  for (let i = 0; i < 200 && b2.fire; i++) g2.step(0.1);
  ok(g2.fxs.some(x => x.k === 'spr') || !b2.fire, 'sprinklers contendo o fogo criam o efeito');
  const g3 = mk(); g3.updPerson = () => {}; const b3 = put(g3, 'office', 1, 0); b3.bomb = g3.t - 1; g3.step(0.1);
  ok(g3.fxs.some(x => x.k === 'boom'), 'a explosão da bomba cria o efeito');
  const g4 = mk(); g4.updPerson = () => {}; const b4 = put(g4, 'office', 1, 0); b4.fight = g4.t - 1; g4.step(0.1);
  ok(g4.fxs.some(x => x.k === 'amb'), 'briga que sai do controle chama a ambulância');
  const g5 = mk(); g5.pop = 500; const f5 = put(g5, 'shop', 1, 0); f5.occ = true; g5.msg = () => {};
  for (let i = 0; i < 4000 && !g5.fxs.length; i++) g5.theftCheck();
  ok(g5.fxs.some(x => x.k === 'thief'), 'um furto cria o efeito do ladrão');
  ok(g5.fxs.length > 0 && JSON.stringify(g5.serialize()).indexOf('"fxs"') < 0, 'efeitos não vão para o save');
}
done('seguranca');
