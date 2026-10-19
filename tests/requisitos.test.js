'use strict';
// Regra única de "funciona?" (RELATORIO-REQUISITOS.md): barulho e circulação só contam salas que funcionam (`serves`),
// fogo bloqueia aluguel e hóspedes, e vagas/pontos do subsolo só valem ligados à saída do túnel (portal com lado).
const {mk, put, ok, done, UTIL, FAC} = require('./helpers');

const world = () => { const g = mk(64); g.updPerson = () => {}; g.placeFloorSpan(1, 0, 127); g.placeStairs('stairs', 0, 56); g.stairs.forEach(s => { s.build = 1; }); g.ver++; return g; };

// barulho: gerador com fogo e bomba de recalque sem energia ficam em silêncio
{
  const g = world(); const c = put(g, 'condo', 1, 0), ger = put(g, 'gerador', 1, 24);
  const n0 = g.noiseOf(c);
  ok(n0 > 0, 'gerador funcionando faz barulho (' + n0.toFixed(2) + ')');
  ger.fire = 1.2; g.ver++; g._utk = null;
  ok(g.noiseOf(c) === 0, 'gerador em chamas não faz barulho');
  ger.fire = 0; g.ver++; g._utk = null;
  ok(g.noiseOf(c) === n0, 'apagado o fogo, o barulho volta');
}
{
  const g = world(); const c = put(g, 'condo', 1, 0), bomba = put(g, 'bombaRecalque', 1, 24);
  const sv = UTIL.grid.energia; UTIL.grid.energia = 0; g.ver++; g._utk = null;
  ok(g.serves(bomba) === false && g.noiseOf(c) === 0, 'bomba sem energia (cutE) não faz barulho');
  UTIL.grid.energia = sv; g._utk = null;
}

// circulação (localPop): sala com fogo não conta como gente passando
{
  const g = world(); const o = put(g, 'office', 1, 0); o.occ = true; o.persons = [{}, {}, {}, {}]; const alvo = put(g, 'shop', 1, 36);
  const p0 = g.localPop(alvo, 48);
  ok(p0 > 0, 'escritório ocupado por perto conta na circulação');
  o.fire = 1.2; g.ver++;
  ok(g.localPop(alvo, 48) === 0, 'com fogo não conta');
  o.fire = 0; o.closed = true; g.ver++;
  ok(g.localPop(alvo, 48) === 0, 'fechada não conta');
}

// aluguel e hóspedes: unidade em chamas não rende nem recebe inquilino/hóspede
{
  const g = world(); const o = put(g, 'office', 1, 16); o.occ = true; o.price = 1;
  const f0 = g.funds; g.quarter(); const renda = g.funds - f0;
  o.fire = 1.2; const f1 = g.funds; g.quarter(); const renda2 = g.funds - f1;
  ok(renda > 0 && renda2 <= renda - FAC.office.prices[1] + 1e-6, 'unidade em chamas não paga o aluguel do trimestre (' + renda + ' → ' + renda2 + ')');
}

// portal com lado: salvar/carregar guarda o lado; save antigo sem lado volta com a saída à direita
{
  const g = mk(64); g.placeFloorSpan(-1, 0, 127); const p = put(g, 'tunnelPortal', -1, 60, {dir: -1});
  const g2 = mk(64); g2.load(JSON.parse(JSON.stringify(g.serialize())));
  ok(g2.facs.find(f => f.k === 'tunnelPortal').dir === -1, 'o lado do portal é salvo e carregado');
  const old = JSON.parse(JSON.stringify(g.serialize())); for (const f of old.facs) delete f.dr;
  const g3 = mk(64); g3.load(old);
  ok(g3.facs.find(f => f.k === 'tunnelPortal').dir === 1, 'save antigo sem lado: saída à direita');
}
// elevador e escada rolante sem energia: aviso (alerta) com a causa, como as salas
{
  const g = world(); g.placeStairs('escalator', 0, 40); g.stairs.forEach(x => { x.build = 1; });
  const sh = g.placeShaft('elevator', 48, 0, 1).shaft;
  const sv = UTIL.grid.energia; UTIL.grid.energia = 0; g.ver++; g._utk = null; g.utilFresh();
  ok(sh.dark && g.stairs.find(x => x.k === 'escalator').dark, 'sem energia, o elevador e a escada rolante param (dark)');
  ok(g.alerts().some(a => /Elevador sem energia/.test(a.title) && /fontes|fonte/.test(a.cause)), 'o elevador sem energia gera alerta com a causa');
  ok(g.alerts().some(a => /escada\(s\) rolante\(s\) sem energia/.test(a.title)), 'a escada rolante sem energia também');
  UTIL.grid.energia = sv; g._utk = null; g.ver++; g.utilFresh();
  ok(!sh.dark && !g.alerts().some(a => /sem energia \(andares/.test(a.title)), 'com energia o aviso some');
}
done('requisitos');
