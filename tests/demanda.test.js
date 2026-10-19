'use strict';
// Salas de serviço (café, coworking, mercadinho, lavanderia, jardim, banco) e o sistema de demanda: cada tipo de unidade procura
// serviços por perto; atendido soma, o que falta desconta, e tudo aparece como motivo mostrado na nota e em "Por que está vago?".
const {FAC, DEMAND, DEMAND_EXTRA, DEMANDV, SERVICES, ok, done, mk: mk0, put} = require('./helpers');
// estes testes medem o efeito da distância, não o acesso: toda sala conta como alcançável (o acesso tem teste próprio em acesso.test.js)
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };

const world = (floors = 4) => { const g = mk(240); g.msg = () => {}; g.star = 5; g.placeFloorSpan(-1, 0, 239); for (let L = 1; L <= floors; L++) g.placeFloorSpan(L, 0, 239); return g; };
const get = (g, f, key) => g.evalBreakdown(f).find(o => o.key === key);
const near = (a, b) => Math.abs(a - b) < 1e-9;
const SVC = ['cafe', 'coworking', 'mercado', 'lavanderia', 'jardim', 'banco'];

// 1. catálogo
{
  ok(SVC.every(k => FAC[k] && FAC[k].svc === k), 'as seis salas existem e cada uma oferece o seu serviço');
  const stars = {cafe: 1, coworking: 2, mercado: 2, lavanderia: 2, jardim: 2, banco: 3};
  ok(SVC.every(k => FAC[k].star === stars[k]), 'estrelas: café 1★, coworking/mercadinho/lavanderia/jardim 2★, banco 3★ (' + SVC.map(k => k + FAC[k].star).join(' ') + ')');
  const g = world(); g.star = 1; ok(!g.canPlaceFac('mercado', 1, 0).ok && g.canPlaceFac('mercado', 1, 0).err === 'Requer 2 estrelas.' && g.canPlaceFac('cafe', 1, 0).ok, 'a estrela exigida vale na hora de construir');
  ok(FAC.coworking.tenant && FAC.coworking.office && FAC.coworking.prices.length === 4 && FAC.coworking.cost > FAC.office.cost && FAC.coworking.cost < FAC.officeEx.cost && FAC.coworking.prices[1] > FAC.office.prices[1] && FAC.coworking.prices[1] < FAC.officeEx.prices[1], 'o coworking fica entre o escritório e o executivo em custo e aluguel');
  ok(FAC.cafe.cost < FAC.fastfood.cost && FAC.cafe.w < FAC.fastfood.w && !FAC.cafe.noisy, 'o café é a versão menor e mais barata da lanchonete, sem barulho');
  ok(!FAC.jardim.commercial && !FAC.jardim.noisy && FAC.jardim.dailyCost > 0, 'o jardim não rende nada, não faz barulho e tem custo de manutenção');
}

// 2. exigências (no máximo 2 por bloco) e extras (bônus sem castigo): cada bloco com o seu perfil
{
  const g = world(); const apt = put(g, 'condo', 1, 0);
  const miss = f => g.demandFactors(f).filter(d => !d.met).map(d => d.svc).sort();
  ok(Object.values(DEMAND).every(l => l.length <= 2), 'nenhum bloco tem mais de 2 exigências (' + Object.entries(DEMAND).map(([k, l]) => k + ':' + l.length).join(' ') + ')');
  ok(JSON.stringify(miss(apt)) === JSON.stringify(['creche', 'mercado']), 'um apartamento (família) exige mercadinho e creche (' + miss(apt).join(', ') + ')');
  const off = put(g, 'office', 2, 0); ok(JSON.stringify(miss(off)) === JSON.stringify(['cafe', 'transporte']) && !miss(off).includes('banco') && !miss(off).includes('academia'), 'um escritório exige café e transporte; bicicletário e academia são extras');
  const kit = put(g, 'kitnet', 3, 0); ok(JSON.stringify(miss(kit)) === JSON.stringify(['cafe', 'lavanderia']), 'uma kitnet exige café e lavanderia');
  const sui = put(g, 'suite', 4, 0); ok(JSON.stringify(miss(sui)) === JSON.stringify(['piscina']), 'uma suíte só exige piscina; jardim e transporte são extras');
  ok(['kitnet', 'single', 'twin'].every(k => DEMAND[k].includes('lavanderia')) && !DEMAND.office.includes('lavanderia') && !DEMAND.condo.includes('lavanderia'), 'a lavanderia é exigência de kitnet e de hotel simples/duplo, não de escritório nem de apartamento');
  const noisy = ['academia', 'convencoes'], sens = Object.keys(FAC).filter(k => FAC[k].sensitive);
  ok(sens.every(k => ![...(DEMAND[k] || []), ...(DEMAND_EXTRA[k] || [])].some(x => noisy.includes(x))), 'quem sofre com barulho nunca pede academia nem convenções, nem como extra (' + sens.join(', ') + ')');
  const shop = put(g, 'shop', 1, 40); ok(JSON.stringify(miss(shop)) === JSON.stringify(['banco']), 'a boutique exige banco');
  const rest = put(g, 'restaurant', 1, 60); ok(g.demandFactors(rest).length === 0, 'quem não tem demanda (restaurante) não ganha nem perde nada');
  ok(Object.entries(DEMAND).filter(([k, l]) => l.includes('banco')).length === 1, 'cada serviço atende poucos tipos: o banco aparece na lista de um só');
  const ex = put(g, 'cafe', 1, 120); put(g, 'jardim', 3, 12); const f2 = g.demandFactors(kit);
  ok(f2.some(d => d.svc === 'jardim' && d.extra && d.met) && !f2.some(d => d.extra && !d.met), 'extra presente dá bônus (jardim por perto da kitnet) e extra ausente não aparece nem desconta');
}

// 3. atendido soma (por distância), o que falta desconta
{
  const g = world(); const off = put(g, 'office', 1, 100 + 8);
  const miss = g.demandFactors(off);
  ok(miss.length === 2 && miss.every(d => !d.met && near(d.v, -Math.min(DEMANDV.miss, DEMANDV.capMiss / miss.length)) && /^Falta .* por perto$/.test(d.label)), 'sem nada por perto: dois motivos negativos "Falta ... por perto" (−2 cada, ou menos quando passa do teto de ' + DEMANDV.capMiss + ')');
  const cafe = put(g, 'cafe', 1, 116);   // colado
  const d1 = g.demandFactors(off).find(d => d.svc === 'cafe');
  ok(d1.met && near(d1.v, DEMANDV.met) && d1.label === 'Tem café por perto', 'café colado: +' + DEMANDV.met + ' ("Tem café por perto")');
  g.facs.splice(g.facs.indexOf(cafe), 1); g.removeFac; 
  const g2 = world(); const o2 = put(g2, 'office', 1, 100 + 8); put(g2, 'cafe', 1, 100 + 8 + 8 + 8);   // 8 unidades de folga
  ok(near(g2.demandFactors(o2).find(d => d.svc === 'cafe').v, DEMANDV.met * (1 - 8 / DEMANDV.range)), 'a 8 unidades de distância o bônus cai na proporção do alcance (' + DEMANDV.range + ')');
  const g3 = world(); const o3 = put(g3, 'office', 1, 20); put(g3, 'cafe', 1, 20 + 8 + DEMANDV.range);   // no limite do alcance
  ok(!g3.demandFactors(o3).find(d => d.svc === 'cafe').met, 'um serviço além do alcance conta como "falta"');
  const g4 = world(); const o4 = put(g4, 'officeEx', 3, 0); put(g4, 'office', 1, 0); put(g4, 'office', 2, 0); put(g4, 'coworking', 3, 16);
  ok(g4.demandFactors(o4).find(d => d.svc === 'coworking').met, 'no mesmo andar e nos andares de cima e de baixo, perto na vertical, também vale');
}

// 4. tetos
{
  const old = {...DEMANDV};
  try {
    DEMANDV.capMet = 8;
    const g = world(); const apt = put(g, 'condo', 1, 0); put(g, 'mercado', 1, 16); put(g, 'creche', 1, 28); put(g, 'lixo', -2, 40); put(g, 'jardim', 1, 40);
    const met = g.demandFactors(apt).filter(d => d.met && !d.extra), sum = met.reduce((a, d) => a + d.v, 0);
    ok(met.length === 2 && near(sum, 8), `o bônus total tem teto (${DEMANDV.capMet}): dois serviços colados somam ${sum.toFixed(1)}, não ${2 * old.met}`);
    DEMANDV.capMiss = 1;
    const g2 = world(); const o2 = put(g2, 'office', 1, 0); ok(near(g2.demandFactors(o2).reduce((a, d) => a + d.v, 0), -1), 'e o desconto total também (' + DEMANDV.capMiss + ')');
  } finally { Object.assign(DEMANDV, old); }
}

// 5. a nota é a soma dos motivos (inclui a demanda) e os motivos aparecem
{
  const g = world(); const apt = put(g, 'condo', 1, 0); apt.occ = true; g.moveIn(apt);
  const before = g.evalFac(apt); put(g, 'mercado', 1, 16);
  const br = g.evalBreakdown(apt), tot = br.reduce((a, o) => a + o.v, 0);
  ok(Math.abs(g.evalFac(apt) - Math.max(0, Math.min(300, tot))) < 1e-9 && get(g, apt, 'svc:mercado') && get(g, apt, 'svc:creche'), 'a nota continua sendo a soma dos motivos, com "Tem mercadinho" e "Falta creche" entre eles');
  ok(g.evalFac(apt) - before > DEMANDV.met * 0.9, 'trocar um "falta" por um "tem" soma pelo menos +' + (DEMANDV.met * 0.9).toFixed(1) + ' na nota (' + (g.evalFac(apt) - before).toFixed(1) + ')');
}

// 6. procura por aluguel e "Por que está vago?"
{
  const g = world(); const off = put(g, 'office', 1, 100);
  const base = g.rentChance(off), r0 = g.vacancyReasons(off);
  ok(r0.filter(r => /^Falta /.test(r.text) && r.sev === 'bad').length === 2, '"Por que está vago?" lista o que falta por perto (2 exigências do escritório), em vermelho');
  put(g, 'cafe', 1, 108); put(g, 'bike', -1, 112); put(g, 'taxi', 0, 240);
  const r1 = g.vacancyReasons(off);
  ok(g.rentChance(off) > base && r1.filter(r => /^Tem /.test(r.text) && r.sev === 'info').length === 3 && !r1.some(r => /^Falta /.test(r.text)), `com as três por perto a procura sobe (${(base * 100).toFixed(0)}% → ${(g.rentChance(off) * 100).toFixed(0)}%) e os motivos viram "Tem ..."`);
  const lim = world(); const o = put(lim, 'office', 1, 100); for (const k of ['cafe', 'bike', 'coworking']) lim.demandFactors = () => [{v: 9999, met: true, svc: k, label: 'x'}];
  ok(lim.rentChance(o) <= 0.28 * 1.6 * 1.3 * 1.3 + 1e-9 && lim.rentChance(o) > 0, 'o efeito na procura tem teto (×1,3)');
}

// 7. o jardim abafa o barulho
{
  const mk2 = withGarden => { const g = world(); put(g, 'restaurant', 1, 0); const apt = put(g, 'condo', 1, 24); if (withGarden) put(g, 'jardim', 1, 40); return {g, apt}; };
  const a = mk2(false), b = mk2(true);
  const na = get(a.g, a.apt, 'noise').v, nb = get(b.g, b.apt, 'noise').v;
  ok(near(nb, na * (1 - DEMANDV.quiet)) && /abafado pelo jardim/.test(get(b.g, b.apt, 'noise').label), `jardim colado abafa ${DEMANDV.quiet * 100}% do barulho (${na.toFixed(0)} → ${nb.toFixed(0)}) e o motivo diz isso`);
  ok(near(b.g.noiseOf(b.apt), a.g.noiseOf(a.apt)), 'o barulho "de fábrica" (noiseOf) não muda: é o jardim que abafa na nota');
  const c = world(); put(c, 'restaurant', 1, 0); const apt = put(c, 'condo', 1, 24); put(c, 'jardim', 1, 24 + 16 + DEMANDV.range);
  ok(near(get(c, apt, 'noise').v, na), 'um jardim longe (fora do alcance) não abafa nada');
}

// 8. as salas funcionam: renda, visitantes, aluguel, manutenção
{
  const g = world(); for (let L = 0; L < 2; L++) g.placeStairs('stairs', L, 100);
  g.pop = 400; const cafe = put(g, 'cafe', 1, 0), far = put(g, 'cafe', 1, 200);
  for (let i = 0; i < 6; i++) { const o = put(g, 'office', 1, 16 + i * 8); o.occ = true; o.persons = new Array(6).fill(0); }
  g.t = 2 * 1440 + 6 * 60; g.people = []; g.planCrowd(g.dayCtx());
  const by = new Map(); for (const p of g.people.filter(p => p.kind === 'visitor')) { const f = p.plan[0].fac; by.set(f, (by.get(f) || 0) + 1); }
  ok((by.get(cafe) || 0) >= 2 && !by.get(far), `o café recebe visitantes onde há gente (${by.get(cafe) || 0}) e um café isolado, nenhum`);
  const f0 = g.funds; g.income('cafe', FAC.cafe.perCustomer);
  ok(g.funds - f0 === FAC.cafe.perCustomer, 'a receita do café entra no caixa');
  const g2 = world(); const w = put(g2, 'coworking', 1, 0); w.occ = true; g2.moveIn(w);
  const def = FAC.coworking;
  ok(w.persons.length >= def.pop - 2 && w.persons.length <= def.pop + 2 && def.prices[w.price] > 0, `coworking ocupado abriga ${w.persons.length} pessoas e paga R$ ${def.prices[w.price]} por trimestre`);
  ok(DEMANDV.rent > 0 && FAC.jardim.dailyCost > 0, 'o jardim tem manutenção diária (R$ ' + FAC.jardim.dailyCost + ')');
}
done('demanda');
