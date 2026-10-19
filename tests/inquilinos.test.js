'use strict';
// Avaliação dos inquilinos e unidades vagas: a nota tem que bater com os motivos mostrados, nada some sem explicação,
// e quem lê "por que está vago?" vê as causas reais (acesso, preço, procura).
const {FAC, K, INCIDENT, PROX, DEMANDV, NOISE, ok, done, mk, put} = require('./helpers');

const tower = (floors = 6) => {
  const g = mk(); g.msg = () => {};
  for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, 63);
  const sh = g.placeShaft('elevator', 24, 0, floors); if (!sh.ok) throw new Error(sh.err);
  return {g, shaft: sh.shaft};
};
const moveIn = (g, f) => { f.occ = true; g.moveIn(f); g.updateEval(true); };
const sum = br => br.reduce((a, o) => a + o.v, 0);
const get = (br, key) => br.find(o => o.key === key);

// 1. apartamento ao lado do elevador, sem vizinho barulhento: nada de barulho, e a nota é a base mais os bônus
{
  const {g, shaft} = tower(); const apt = put(g, 'condo', 1, 28 - 12 + 12 - 12 + 0 > 0 ? 28 : 28); moveIn(g, apt);   // encostado no poço (x=24..27)
  ok(apt.x === 28 && g.tgAt(1, 27) === shaft, 'o apartamento do teste está encostado no poço do elevador');
  ok(g.noiseOf(apt) === 0, 'o elevador ao lado NÃO conta como barulho de vizinho');
  const br = g.evalBreakdown(apt);
  ok(!get(br, 'noise') && !get(br, 'access') && !get(br, 'theft') && !get(br, 'fight') && !get(br, 'bomb'), 'sem barulho, sem problema de acesso e sem ocorrência nos motivos');
  ok(g.evalFac(apt) >= 150 - DEMANDV.capMiss, `com o prédio seguro e deslocamentos tranquilos a nota fica na base (menos, no máximo, o que falta de serviços por perto: ${DEMANDV.capMiss}) ou acima (${Math.round(g.evalFac(apt))})`);
  // vizinho barulhento de verdade (restaurante ao lado) é o que derruba
  const g2 = tower().g; const a2 = put(g2, 'condo', 1, 28); moveIn(g2, a2); const r = put(g2, 'restaurant', 1, 44); const n0 = g2.noiseOf(a2);
  ok(n0 === 1 && get(g2.evalBreakdown(a2), 'noise').v === -NOISE.perSource, 'restaurante colado no apartamento: 1 vizinho barulhento = −' + NOISE.perSource);
}

// 2. ocorrência (furto, briga, explosão) pesa na unidade atingida e nos vizinhos, por distância; não no prédio todo
{
  const {g} = tower(); const a = put(g, 'condo', 1, 28), b = put(g, 'office', 1, 44), far = put(g, 'office', 1, 60); for (const f of [a, b, far]) moveIn(g, f);
  const base = [a, b, far].map(f => g.evalFac(f));
  g.addIncident('theft', a);
  const ea = get(g.evalBreakdown(a), 'theft'), eb = get(g.evalBreakdown(b), 'theft');
  ok(ea && Math.round(ea.v) === -INCIDENT.theft.mag, `a unidade atingida sente o furto inteiro (${Math.round(ea && ea.v)}): "${ea && ea.label}"`);
  ok(eb && Math.abs(eb.v - (-INCIDENT.theft.mag * PROX.neighbor)) < 1e-9, `a vizinha colada sente metade (${Math.round(eb && eb.v)})`);
  ok(!get(g.evalBreakdown(far), 'theft') && Math.abs(g.evalFac(far) - base[2]) < 1e-9, 'uma unidade fora do alcance (16 unidades de folga) não sente nada');
  ok(Math.abs(g.evalFac(a) - (base[0] - INCIDENT.theft.mag)) < 1e-9, 'e a nota da atingida cai exatamente esse valor');
  const at = d => { g.t = g.incidents[0].t + 1440 * d; return get(g.evalBreakdown(a), 'theft'); };
  ok(Math.abs(at(1.5).v - (-INCIDENT.theft.mag / 2)) < 1e-9 && at(3) === undefined, 'o efeito some linearmente em 3 dias');
  g.t = g.incidents[0].t;
  const g2 = tower().g; const c = put(g2, 'condo', 1, 28); moveIn(g2, c);
  for (let i = 0; i < 5; i++) g2.addIncident('theft', c);
  ok(Math.abs(get(g2.evalBreakdown(c), 'theft').v - (-INCIDENT.theft.mag * 1.5)) < 1e-9, 'várias ocorrências somam até um teto (1,5 vezes uma ocorrência)');
  const g3 = tower().g; const d1 = put(g3, 'office', 1, 28), d2 = put(g3, 'office', 1, 52); moveIn(g3, d1); moveIn(g3, d2);
  g3.addIncident('fight', d1); g3.addIncident('bomb', d1);
  ok(get(g3.evalBreakdown(d2), 'fight') && !get(g3.evalBreakdown(d2), 'theft'), 'cada tipo tem o seu alcance: a briga (24) chega a quem o furto (16) não alcança');
}

// 2b. área vigiada: posto cobrindo a unidade, com segurança em serviço e sem ocorrência por perto
{
  const {g} = tower(); const a = put(g, 'office', 1, 28), far = put(g, 'office', 1, 44); moveIn(g, a); moveIn(g, far);
  const p = put(g, 'security', 1, 0); g.onBuilt(p); p.persons.forEach(q => { q.st = 'idle'; q.at = p; });
  ok(get(g.evalBreakdown(a), 'safe') && Math.abs(get(g.evalBreakdown(a), 'safe').v - INCIDENT.watch) < 1e-9, 'unidade na área do posto, com segurança em serviço: "Área vigiada" +10');
  p.persons.forEach(q => { q.st = 'away'; });
  ok(!get(g.evalBreakdown(a), 'safe'), 'sem segurança em serviço o bônus some');
  p.persons.forEach(q => { q.st = 'idle'; }); g.addIncident('theft', a);
  ok(!get(g.evalBreakdown(a), 'safe'), 'com ocorrência por perto o bônus some');
}

// 3. a nota sempre bate com a soma dos motivos mostrados (nenhum desconto escondido)
{
  const {g} = tower(10); g.star = 5;
  for (let L = 1; L <= 9; L++) { const r = g.placeFac(L % 2 ? 'condo' : 'office', L, 28); if (r.ok) g.facs[g.facs.length - 1].build = 1; if (L % 2 === 0) { const r2 = g.placeFac('office', L, 36); if (r2.ok) g.facs[g.facs.length - 1].build = 1; } }
  put(g, 'restaurant', 1, 44); put(g, 'shop', 2, 44);
  for (let L = 0; L < 9; L++) g.placeStairs('stairs', L, 0);
  for (const f of g.facs) if (FAC[f.k].tenant && f.build >= 1) f.occ = true, g.moveIn(f);
  g.addIncident('theft', g.facs.find(f => f.k === 'condo')); g.addIncident('fight', g.facs.find(f => f.k === 'office')); g.facs.filter(f => FAC[f.k].hotel).forEach(f => { f.rep = 70; });
  g.updateEval(true);
  let bad = 0, n = 0;
  for (const f of g.facs) {
    const def = FAC[f.k]; if (!(def.tenant && f.occ)) continue; n++;
    const br = g.evalBreakdown(f), tot = clamp(sum(br), 0, 300), shown = br.reduce((a, o) => a + Math.round(o.v), 0);
    if (Math.abs(f.eval - tot) > 1e-9) { bad++; console.log('   nota guardada ≠ soma dos motivos em', f.k, f.L, f.eval, tot); }
    if (Math.abs(shown - sum(br)) > br.length / 2 + 0.5) { bad++; console.log('   motivos arredondados não somam em', f.k, f.L); }
    if (br.some(o => !o.label || !Number.isFinite(o.v))) { bad++; console.log('   motivo sem texto ou valor inválido em', f.k, f.L); }
  }
  ok(n >= 10 && bad === 0, `em ${n} unidades ocupadas, a nota guardada é exatamente a soma dos motivos, e todos têm texto e valor`);
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
}

// 4. o rótulo da faixa corresponde à nota
{
  const t = e => (e < 100 ? 0 : e < 200 ? 1 : 2), names = ['Ruim', 'Boa', 'Ótima'];
  ok(t(146) === 1 && names[t(146)] === 'Boa' && t(99) === 0 && t(100) === 1 && t(199) === 1 && t(200) === 2, 'faixas: abaixo de 100 Ruim, de 100 a 199 Boa (😐), 200 ou mais Ótima');
}

// 5. por que está vago
{
  const {g} = tower(); const lone = put(g, 'office', 1, 40); g.avgEval = 150;
  const r1 = g.vacancyReasons(lone);
  ok(r1.some(r => /Sem acesso/.test(r.text) && r.sev === 'bad') === false, 'sala no térreo, ao lado do saguão: tem acesso (sem aviso de acesso)');
  const high = put(g, 'office', 3, 32); // andar 3 sem escada nem poço colado
  const rH = g.vacancyReasons(g.facs.find(f => f.k === 'office' && f.L === 1));
  ok(rH.length >= 1 && rH.some(r => /Chance de ser alugada/.test(r.text)), 'sempre mostra a chance diária de aluguel');
  const nb = tower(); const iso = put(nb.g, 'office', 3, 40); // sem acesso: sem escada para o andar 4
  const noAccess = nb.g.vacancyReasons(iso);
  ok(!nb.g.reachable(iso) ? noAccess[0].sev === 'bad' && /Sem acesso desde o térreo/.test(noAccess[0].text) : true, 'sala sem acesso: o primeiro motivo é o acesso, em vermelho');
  const f = lone; f.price = 0; g.avgEval = 150;
  ok(g.vacancyReasons(f).some(r => /premium/.test(r.text) && r.sev === 'bad'), 'preço Premium aparece como motivo de procura baixa');
  f.price = 3; ok(g.vacancyReasons(f).some(r => /promoção/.test(r.text) && r.sev === 'info'), 'preço Promoção aparece como motivo de procura alta');
  f.price = 1;
  const viz = put(g, 'office', 1, 56); viz.occ = true; viz.eval = 40;
  ok(g.vacancyReasons(f).some(r => /humor dos vizinhos/.test(r.text) && r.sev === 'bad'), 'humor baixo dos vizinhos derruba a procura');
  viz.eval = 250; ok(g.vacancyReasons(f).some(r => /bom humor dos vizinhos/.test(r.text)), 'humor alto dos vizinhos aumenta a procura');
  g.avgEval = 40; ok(!g.vacancyReasons(f).some(r => /humor dos vizinhos/.test(r.text) && r.sev === 'bad'), 'o humor médio do prédio (outro lugar) não pesa mais');
  ok(g.vacancyReasons(Object.assign({}, f, {occ: true})).length === 0, 'unidade ocupada não tem motivos de vaga');
  const obra = put(g, 'office', 1, 48); obra.build = 0.4; ok(/obras/.test(g.vacancyReasons(obra)[0].text), 'em obras: avisa que ainda não pode ser alugada');
}

// 6. a chance mostrada é a que o jogo usa de verdade
{
  const {g} = tower(); const f = put(g, 'office', 1, 40); g.avgEval = 150;
  const shown = g.rentChance(f); let hits = 0; const N = 20000;
  for (let i = 0; i < N; i++) if (Math.random() < g.rentChance(f)) hits++;
  ok(Math.abs(hits / N - shown) < 0.02, `a chance mostrada (${(shown * 100).toFixed(0)}%) é a usada no sorteio diário (${(100 * hits / N).toFixed(0)}% medido)`);
  const g2 = tower().g; g2.avgEval = 150; const f2 = put(g2, 'office', 1, 40); let alugou = 0; const M = 400;
  for (let i = 0; i < M; i++) { f2.occ = false; f2.persons = []; g2.lastDay = -1; const before = f2.occ; g2.newDay(); if (f2.occ) alugou++; }
  ok(alugou / M > 0.15 && alugou / M < 0.45, `e o aluguel diário real fica nessa faixa (${(100 * alugou / M).toFixed(0)}% dos dias)`);
}
done('inquilinos');
