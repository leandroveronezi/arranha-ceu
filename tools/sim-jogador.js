#!/usr/bin/env node
'use strict';
// Simulação de um jogador automático "atento": monta a torre por blocos (saguão + poço de elevador + fileiras de salas), cuida da infraestrutura
// ANTES de crescer (energia e água são locais: ver `utilCalc` em game.js) e mede o resultado. Sem trapaça: só usa a API de construção do jogo
// (`placeFac`, `placeShaft`, `extendShaft`, `addCar`, `placeFloorSpan`, `placeStairs`), gasta dinheiro de verdade e espera as obras terminarem.
// Uso: node tools/sim-jogador.js [dias=40] [estrela-alvo=3] [semente=1] [perfil=padrao]      (perfis: padrao | cauteloso | agressivo)
//   SIM_SET="QDAYS=4;UTIL.grid.energia=900" troca constantes de data.js só nesta simulação (separe por ';' ou ','; 'A.b.c=1' vale para campos de objetos)
//   SIM_STEP=0.4 (s por passo; 0.8 acelera mas distorce o estresse dos elevadores), SIM_RES=6 liga apartamentos nos andares 1..6 (desligado: a venda é devolvida se o morador sai), SIM_NOSAVE=1 não junta dinheiro para abrir bloco.
//   SIM_BLOCKS=N (teto de blocos; padrão 20), SIM_GAP=N (vão sem laje entre blocos, padrão 4 unidades; 0 cola as torres e a rota de cada pessoa passa a percorrer o grafo inteiro: ~3x mais lento),
//   SIM_MAX_SECONDS=N (encerra e imprime o resumo ao estourar o tempo real), SIM_SKY=1 (saguão aéreo no andar 14 + expresso por bloco), SIM_HOTEL=1 / SIM_RESBLK=1 (blocos de hotel e residenciais a cada SIM_MIXMOD blocos, padrão 4, depois do 3★),
//   SIM_SECROWS=1 (volta o posto de segurança dentro das fileiras de escritório em vez dos andares técnicos).
//   SIM_DEBUG=1 mostra cada construção de infraestrutura e o motivo das esperas.
//
// Política (em ordem de prioridade a cada decisão, a cada hora de jogo):
//  1. infraestrutura pendente espera terminar a obra (nada em duplicata);
//  2. cortes de energia/água (`cutE/cutA`, motivo 'reach' ou 'cap'): constrói a fonte certa PERTO dos cortados (gerador, bomba, caixa d'água e recalque);
//  3. antes de abrir uma fileira nova confere se alguma fonte alcança os dois lados dela e se a capacidade projetada (tudo ocupado, estação atual) basta; senão
//     constrói a fonte primeiro, ou espera juntar dinheiro, ou pára de subir (quando só uma estrela maior resolve);
//  4. cresce por fileiras (10% de caixa de reserva, só enquanto a vacância está baixa), elevadores (cabines, 2º poço) e as exigências do bloco (`DEMAND`);
//  4b. depois do 3★, com caixa sobrando, abre blocos em paralelo (cada bloco é uma torre de 29 andares com o próprio saguão, poço(s) e vão de 4 unidades até o vizinho: pouco tráfego por poço, rotas curtas);
//  5. a cada estrela usa o que liberou (taxi/ônibus, hidrante, sprinkler, creche, coworking, posto de segurança, clínica, bateria, gerador a gás, bomba reforçada).
const fs = require('fs'), vm = require('vm'), path = require('path');
const DAYS = +process.argv[2] || 40, TARGET = +process.argv[3] || 3, PROFILE = process.argv[5] || 'padrao';
let seed = (+process.argv[4] || 1) >>> 0;
const rng = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const SM = Object.create(Math); SM.random = rng;
const DEBUG = !!process.env.SIM_DEBUG, SAVE_OFF = process.env.SIM_NOSAVE === '1';
const PROFILES = {   // reserva = múltiplo da manutenção de um trimestre; vac = vacância máxima para abrir fileira nova; folga = margem sobre o consumo projetado
  padrao:    {blocks: +process.env.SIM_BLOCKS || 20, openAt: 10, reserve: 1.0, vac: 0.45, folgaE: 1.15, folgaA: 1.15},
  cauteloso: {blocks: 3, openAt: 14, reserve: 2.0, vac: 0.20, folgaE: 1.40, folgaA: 1.30},
  agressivo: {blocks: +process.env.SIM_BLOCKS || 20, openAt: 6, reserve: 0.4, vac: 0.55, folgaE: 1.00, folgaA: 1.00},
};
const P = PROFILES[PROFILE]; if (!P) throw new Error('perfil desconhecido: ' + PROFILE + ' (padrao | cauteloso | agressivo)');

const ctx = vm.createContext({console, Math: SM, Date, performance: {now: () => Date.now()}, window: {}, document: {}, localStorage: {}, location: {search: ''}});
let src = ['data', 'game'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n;');
const dotted = [];
for (const kv of (process.env.SIM_SET || '').split(/[;,]/).map(s => s.trim()).filter(Boolean)) {
  const [k, v] = kv.split('=');
  if (/[.\[]/.test(k)) { dotted.push([k, v]); continue; }
  const re = new RegExp('(const (?:[A-Za-z_, ]*?, )?' + k + ' = )[^,;]+');
  if (!re.test(src)) throw new Error('constante não encontrada: ' + k);
  src = src.replace(re, '$1' + v);
}
vm.runInContext(src + '\n;globalThis.__G = Game; globalThis.__A = {FAC, STAR_POP, UTIL, USE, MIN_PER_SEC, QDAYS, SEASONS, START_FUNDS, TRANSPORT, DEMAND, SVC_STAR, SEC, CORR, PROX, SEASON_DAYS};', ctx);
for (const [k, v] of dotted) vm.runInContext(k + ' = ' + v + ';', ctx);
const {FAC, STAR_POP, UTIL, USE, MIN_PER_SEC, QDAYS, SEASONS, TRANSPORT, DEMAND, SEC} = ctx.__A;

const g = new ctx.__G();
const events = {};
if (DEBUG) { const ex = g.expense.bind(g); g.expense = (c, a) => { if (a >= 5000) dbg('despesa', c, Math.round(a / 1000) + 'k'); ex(c, a); }; }
g.msg = (t) => { for (const [re, k] of [[/Apagão|apagão/, 'apagão'], [/Falta d/, 'falta d\'água'], [/Incêndio|incêndio/, 'incêndio'], [/Furto|furto/, 'furto'], [/briga/i, 'briga'], [/saíram/, 'inquilinos saíram']]) if (re.test(t)) events[k] = (events[k] || 0) + 1; };
let lastDbg = '';
const dbg = (...a) => { if (DEBUG) { const key = a.join(' '); if (key === lastDbg) return; lastDbg = key; } if (DEBUG) console.log(`  [d${g.day} ${String(Math.floor(g.minute / 60)).padStart(2, '0')}h ${Math.round(g.funds / 1000)}k]`, ...a); };

// ------------------------------------------------------------------ geometria do bloco (64 unidades)
//   x:  0..23 meia esquerda | 24..31 vaga central (serviço/utilidade) | 32..55 meia direita | 56..59 poço | 60..63 2º poço (ou vazio)
// Os serviços ficam no lado de dentro das meias (perto da vaga central) para alcançarem as duas pontas (alcance de serviço = 32 unidades).
const GAP = process.env.SIM_GAP === undefined ? 4 : +process.env.SIM_GAP;   // vão sem laje entre blocos: cada bloco é um trecho de piso próprio (a rota de cada pessoa só percorre o bloco dela; torres coladas viram um grafo gigante)
const BW = 64, BS = BW + GAP, CX = 24, SHX = 56, SH2X = 60, MAXH = 29;
const blocks = [];
const sumVals = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
let lastMaint = 0;
// o apartamento vendido é devolvido se o morador sai descontente (reembolso do preço): com apartamentos ocupados a reserva guarda um deles
const condoRisk = () => g.facs.some(f => f.k === 'condo' && f.occ) ? FAC.condo.prices[1] * 0.7 : 0;
const reserve = () => Math.max(80000, P.reserve * lastMaint * 1.1) + infraNeed + condoRisk();   // o trimestre seguinte cobra mais manutenção que o anterior (a torre cresce)
const INFRA_RES = 70000;       // infraestrutura pode furar a reserva de crescimento, não o piso
const afford = (cost, floor) => g.funds - cost >= floor;
const placeable = (k, L, x, o) => { const r = g.canPlaceFac(k, L, x, o); return r.ok || (r.err && r.err.startsWith('Dinheiro')); };
const place = (k, L, x, o) => { const r = g.placeFac(k, L, x, o); return r.ok ? r.fac : null; };
const stars = () => g.star;
const kindCost = (k, w) => FAC[k].cost * (w || FAC[k].w) / FAC[k].w;

// ------------------------------------------------------------------ planta de cada andar
// Duas meias de 24 unidades (do lado de fora para dentro); andares em ciclo de 3: serviços / escritórios / residências (a partir do 2★)
const RESBLK = process.env.SIM_RESBLK === '1';   // a cada 4 blocos um é residencial (kitnets e apartamentos com os serviços que eles exigem)
const HOTELBLK = process.env.SIM_HOTEL === '1';   // a cada 4 blocos um é hotel (duplos e suítes, camareiras, elevador de serviço)
const MIXMOD = +process.env.SIM_MIXMOD || 4;
const blockType = i => g.star < 3 ? 'off' : HOTELBLK && i % MIXMOD === 1 ? 'hotel' : RESBLK && i % MIXMOD === 3 ? 'res' : 'off';
const SEC_ROWS = process.env.SIM_SECROWS === '1';   // padrão: os postos vão nos andares técnicos (8, 16, 24), que cobrem 6 andares para cima e para baixo e o bloco todo na largura
const HALF = 24;
// saguão aéreo (SIM_SKY=1): cada bloco vira duas torres empilhadas, uma de 1..14 (poço A) e outra de 15..29 (poço B, começa no andar 14), ligadas por um elevador expresso
// do térreo ao saguão aéreo do andar 14 (x 48..55, andares 1..15 livres para o poço e a casa de máquinas). Quem vai ao alto pega o expresso e troca de cabine, em vez de esperar um poço de 29 paradas.
const SKY = process.env.SIM_SKY === '1', SKY_L = 14, EXPX = 48;
const skyCol = L => SKY && L >= 1 && L <= SKY_L + 1;
const pad = (items, half = HALF, fill = 'corridor') => { let w = items.reduce((a, k) => a + FAC[k].w, 0); const out = items.slice(); while (w < half) { out.unshift(fill); w += FAC[fill].w; } return out; };
const outerCorr = L => g.star >= 3 && L % 2 ? 'corridorSpr' : g.star >= 2 && L % 2 ? 'corridorHyd' : L % 2 ? 'corridorExt' : 'corridorCam';   // extintor/hidrante/sprinkler nos andares ímpares (cobrem 1 andar acima e abaixo), câmera nos pares
// residências (apartamento: o preço da venda é DEVOLVIDO se o morador sai descontente, p.ex. num corte de energia) ficam desligadas por padrão: SIM_RES=6 liga nos andares 1..6
const RESMAX = +process.env.SIM_RES || 0, RESMOD = 3;
const rowKind = L => L % 3 === 0 ? 'svc' : L > RESMAX || (RESMOD === 3 && L % 3 === 1) ? 'off' : 'res';   // residências (sensíveis a barulho) só nos andares baixos, longe dos geradores dos andares médios
const isTech = L => L % 8 === 0;   // andar técnico: só laje com vagas livres para geradores (barulho longe dos inquilinos sensíveis), no meio de cada faixa de 8 andares
const rowPlan = (L, b) => {
  if (isTech(L)) return [];
  const star = g.star, items = [];   // [chave, x relativo]
  const resBlock = b && b.type === 'res', hotelBlock = b && b.type === 'hotel', kind = resBlock || hotelBlock ? (L % 3 === 0 ? 'svc' : 'res2') : rowKind(L);
  let left, right;   // externo -> interno
  if (hotelBlock && kind === 'svc') {   // hotel: camareiras (precisam do elevador de serviço), lavanderia (exigência do quarto simples e do duplo) e, a partir do 4★, piscina (duplo e suíte)
    const j = Math.floor(L / 3);
    left = pad([outerCorr(L), 'housekeeping'], HALF, 'corridorCam');
    right = j % 2 && star >= 4 ? pad([outerCorr(L), 'piscina'], HALF, 'corridorCam') : [outerCorr(L), 'cafe', 'lavanderia'];
    items.push(['cafe', CX]);
  } else if (hotelBlock) { left = right = L % 3 === 1 ? ['twin', 'twin', 'twin'] : ['suite', 'suite']; }
  else if (resBlock && kind === 'svc') {   // bloco residencial: a cada 3 andares serviços de bairro (DEMAND: kitnet = café+lavanderia, apartamento = mercadinho+creche), alternando para caber tudo no alcance de 32 unidades
    const j = Math.floor(L / 3);
    left = pad([outerCorr(L), 'cafe', j % 2 ? 'creche' : 'mercado'], HALF, 'corridorCam');
    right = j % 2 ? pad([outerCorr(L), 'jardim'], HALF, 'corridorCam') : [outerCorr(L), 'cafe', 'lavanderia'];
    items.push(['bike', CX]);
  } else if (resBlock) { left = right = L % 3 === 1 ? ['kitnet', 'kitnet'] : pad(['condo'], HALF, 'corridorCam'); }
  else if (kind === 'off') left = right = ['office', 'office', 'office'];
  else if (kind === 'res') left = right = ['office', 'condo'];
  else {
    const res = RESMAX > 0;   // com apartamentos o bloco precisa de mercadinho (2★) e creche (3★); só com escritórios, de café, transporte e coworking
    left = pad([outerCorr(L), 'office', res && star >= 2 ? 'mercado' : 'office'], HALF, 'corridorCam');   // a ponta da fileira de serviços vigia com câmera (cobre 1 andar acima e abaixo, 12 unidades)
    right = pad([outerCorr(L), 'office', res && star >= 3 ? 'creche' : star >= 2 ? 'coworking' : 'office']);
    if (star >= 2 && L % 10 === 6 && SEC_ROWS) right = ['office', 'security'];   // (modo antigo) posto numa fileira de escritórios
    items.push(['cafe', CX]);
  }
  if (skyCol(L)) { const i = right.indexOf('office'); if (i >= 0) right = right.filter((_, j) => j !== i); right = pad(right.filter(k => k !== 'corridor'), 16); }
  if (SKY && L === SKY_L) items.push(['lobby', EXPX], ['lobby', EXPX + 4]);
  if ((kind === 'off' || kind === 'res2') && L > 2) items.push([outerCorr(L), CX], ['corridorExt', CX + 4]);   // vaga central dos escritórios: corredores de proteção (as vagas de utilidade ficam nos andares %3 = 2)
  // corredor externo de verdade (o primeiro item de 'pad' já pode ser corredor); nas outras linhas põe um corredor na ponta quando dá
  let x = 0; for (const k of left) { items.push([k, x]); x += FAC[k].w; }
  const rr = right.slice().reverse(); x = 32; for (const k of rr) { items.push([k, x]); x += FAC[k].w; }
  return items;
};

// ------------------------------------------------------------------ utilidades: alcance, consumo projetado, locais de construção
const util = () => g.utilFresh();
const fullUse = (f, i) => { const u = USE[f.k]; return u && u[i] ? u[i] * f.w : 0; };
const seasonF = (res, d = 0) => SEASONS[(g.season + d) % 4][res === 'energia' ? 'energia' : 'agua'];
// consumo projetado com tudo ocupado e na pior das estações próximas (a atual ou a que vem amanhã)
const projUse = (res, extra = 0) => {
  const i = res === 'energia' ? 0 : 1;
  let a = 0; for (const f of g.facs) if (!f.dead && f.k !== 'ruin') a += fullUse(f, i);
  if (res === 'energia') { for (const s of g.shafts) a += s.cars.length * UTIL.elevator; for (const s of g.stairs) if (s.k === 'escalator') a += UTIL.escalator; }
  const f = Math.max(seasonF(res), g.day % ctx.__A.SEASON_DAYS === ctx.__A.SEASON_DAYS - 1 ? seasonF(res, 1) : 0);
  return (a + extra) * f;
};
const flow = res => g.utilFlow(res);
const dist = (a, b) => g.roomDist(a, b);
const rectOf = (k, L, x) => ({L, x, w: FAC[k].w, h: FAC[k].h});
const reachOf = k => { const u = FAC[k].util || {}; return u.reach || UTIL.reach.own; };
// alguma fonte atual (já construída) alcança o retângulo r? (capacidade à parte)
const covered = (res, r) => {
  for (const s of g.utilSources(res)) if (dist(s.f, r) <= s.reach) return true;
  if (res === 'agua') for (const c of g.storeFacs('agua')) if (r.L <= c.L + c.h - 1 && dist(c, r) <= UTIL.reach.own && g.pumpBelow(c)) return true;
  return false;
};
// locais candidatos (andar, x) para uma sala de utilidade de largura w: subsolo do bloco e vaga central dos andares já levantados
const ensureBasement = (b, L) => {
  if (g.slab.get(L, b.x0 + 4) && g.slab.get(L, b.x0 + 60)) return true;
  const c = g.floorCheck(L, b.x0, b.x0 + BW - 1);
  if (!c.ok) return false;
  if (!afford(c.cost, INFRA_RES)) return false;
  g.placeFloorSpan(L, b.x0, b.x0 + BW - 1); return true;
};
const sitesFor = (k, upTo) => {
  const d = FAC[k], out = [];
  for (const b of blocks) if (b.init) {
    if (d.under) for (const L of [-1, -2]) { if (L === -2 && !g.slab.get(-1, b.x0 + 4)) continue; for (let x = b.x0; x + d.w <= b.x0 + BW; x += 4) out.push({L, x, b}); }
    if (d.above && !d.underOnly) for (let L = 1; L <= Math.min(upTo ?? b.top + 1, b.top + 1); L++) {
      if (isTech(L)) { for (let x = 0; x + d.w <= 56; x += 8) if (!(skyCol(L) && x + d.w > EXPX && x < EXPX + 8)) out.push({L, x: b.x0 + x, b}); }
      else if (L % 3 === 2 && d.h === 1) out.push({L, x: b.x0 + CX, b});
    }
  }
  return out;
};
// melhor local para a sala k: maximiza o peso dos alvos {r, w} ao alcance (empate: subsolo, mais perto do centro)
const bestSite = (k, targets, filter) => {
  const d = FAC[k], reach = reachOf(k); let best = null;
  for (const s of sitesFor(k)) {
    if (!placeable(k, s.L, s.x)) continue;
    const r = rectOf(k, s.L, s.x); if (filter && !filter(r)) continue;
    let sc = 0; for (const t of targets) if (dist(r, t.r) <= reach && (!d.util.store || !d.util.store.down || t.r.L <= r.L + r.h - 1)) sc += t.w;
    const tie = (s.L < 0 ? 0.01 : 0) - Math.abs(s.x - s.b.x0 - CX) * 1e-5 - (s.L < 0 ? -s.L * 1e-4 : 0);
    if (sc > 0 && (!best || sc + tie > best.sc)) best = {...s, sc: sc + tie, raw: sc};
  }
  return best;
};
const pendingInfra = () => g.facs.some(f => f.build < 1 && FAC[f.k].util);
let infraBuilt = {}, infraNeed = 0;   // infraNeed: custo da obra de infraestrutura que está esperando dinheiro (o crescimento deixa essa quantia de lado)
const buildInfra = (k, site, why) => {
  if (site.L < 0 && !ensureBasement(site.b, site.L)) return false;
  const cost = kindCost(k) + (site.L > 0 ? 0 : 0);
  if (!afford(cost, INFRA_RES)) { dbg('espera dinheiro para', k, '(' + Math.round(cost / 1000) + 'k) —', why); infraNeed = Math.max(infraNeed, cost); return 'wait'; }
  const f = place(k, site.L, site.x); if (!f) return false;
  infraBuilt[k] = (infraBuilt[k] || 0) + 1; dbg('construiu', k, 'no andar', site.L, 'x', site.x, '—', why); return true;
};
const genKind = () => g.star >= 4 ? 'geradorGas' : 'gerador';
const batKind = () => g.star >= 4 ? 'bateriaGrande' : 'bateria';   // o melhor que a estrela já liberou
const caixaKind = () => g.star >= 5 && !g.facs.some(f => f.k === 'caixaTorre') ? 'caixaTorre' : g.star >= 4 ? 'caixaGrande' : g.star >= 2 ? 'caixaMedia' : 'caixa';
const pumpKinds = () => ['bomba', 'bombaMedia', 'bombaForte'].filter(k => FAC[k].star <= g.star);

// pesos dos alvos: salas cortadas (pelo consumo cheio), elevadores às escuras como retângulos do poço
const cutTargets = (res) => {
  const flag = res === 'energia' ? 'cutE' : 'cutA', i = res === 'energia' ? 0 : 1, out = [];
  for (const f of g.facs) if (f[flag] && f.build >= 1 && !f.dead && fullUse(f, i) > 0) out.push({r: f, w: Math.max(1, fullUse(f, i)), why: res === 'energia' ? f.cutWhyE : f.cutWhyA});
  if (res === 'energia') for (const s of g.shafts) if (s.dark) out.push({r: {L: Math.round((s.lo + s.hi) / 2), x: s.x, w: s.w, h: 1}, w: s.cars.length * UTIL.elevator + 4, why: 'cap'});
  return out;
};
// corrige cortes: escolhe o tipo mais barato cujo melhor local cobre quase todo o peso cortado
const fixCuts = (res) => {
  const t = cutTargets(res); if (!t.length) return false;
  const tot = t.reduce((a, o) => a + o.w, 0);
  const kinds = res === 'energia' ? [genKind() === 'geradorGas' && tot > 170 ? 'geradorGas' : 'gerador'] : pumpKinds();
  let pick = null;
  for (const k of kinds) { const s = bestSite(k, t); if (s && (!pick || s.raw > pick.s.raw + 1e-9) && (!pick || pick.s.raw < 0.9 * tot)) pick = {k, s}; if (pick && pick.s.raw >= 0.9 * tot) break; }
  if (!pick && res === 'agua') return fixWaterChain(t);
  if (!pick) { dbg('sem local para', res, 'peso', Math.round(tot)); return false; }
  return buildInfra(pick.k, pick.s, `corte ${res} (${[...new Set(t.map(o => o.why))].join('/')}, ${t.length} salas, peso ${Math.round(tot)})`);
};
// água para andares que nenhuma bomba alcança: caixa d'água em andar já levantado com bomba abaixo ao alcance; depois recalque + caixa mais acima
const fixWaterChain = (t) => {
  const pumps = g.utilSources('agua').filter(s => s.kind === 1);
  const fed = r => pumps.some(s => s.f.L < r.L && dist(s.f, r) <= s.reach);
  const ck = caixaKind();
  let s = bestSite(ck, t, fed);
  if (s) return buildInfra(ck, s, 'caixa d\'água alcançada por bomba do subsolo');
  const A = g.storeFacs('agua').filter(c => fed(c));
  for (const a of A) {
    const boost = FAC[a.k].util.lift ? a : g.facs.find(f => f.k === 'bombaRecalque' && f.build >= 1 && dist(f, a) <= UTIL.liftReach);   // a torre já traz o recalque dela
    if (!boost) {
      const rs = sitesFor('bombaRecalque').filter(q => placeable('bombaRecalque', q.L, q.x) && dist(rectOf('bombaRecalque', q.L, q.x), a) <= UTIL.liftReach)[0];
      if (rs) return buildInfra('bombaRecalque', rs, 'recalque ao lado da caixa de baixo');
    } else {
      const sb = bestSite(ck === 'caixaTorre' ? 'caixaGrande' : ck, t, r => r.L > a.L && dist(r, a) <= UTIL.reach.own);
      if (sb) return buildInfra(ck === 'caixaTorre' ? 'caixaGrande' : ck, sb, 'caixa mais alta alimentada pelo recalque');
    }
  }
  dbg('água: nenhuma cadeia possível'); return false;
};
// capacidade projetada insuficiente: mais uma fonte onde há mais consumo ao alcance
const fixCapacity = (res) => {
  const i = res === 'energia' ? 0 : 1, folga = res === 'energia' ? P.folgaE : P.folgaA;
  const need = projUse(res) * folga, have = flow(res) + (res === 'energia' ? 0 : 0);
  if (need <= have) return false;
  const t = g.facs.filter(f => !f.dead && f.k !== 'ruin' && fullUse(f, i) > 0).map(f => ({r: f, w: fullUse(f, i)}));
  const kinds = res === 'energia' ? [genKind()] : pumpKinds();
  let pick = null;
  for (const k of kinds) { const s = bestSite(k, t); if (!s) continue; const perCost = (FAC[k].util[res] || 0) / FAC[k].cost; if (!pick || (need - have > FAC[pick.k].util[res] && FAC[k].util[res] > FAC[pick.k].util[res]) ) pick = {k, s}; }
  if (!pick) return false;
  return buildInfra(pick.k, pick.s, `capacidade ${res}: projetado ${Math.round(need)} > ${Math.round(have)}`);
};

// ------------------------------------------------------------------ crescimento
const tenantStats = () => { let n = 0, vac = 0; for (const f of g.facs) if (FAC[f.k].tenant && f.build >= 1 && !f.dead) { n++; if (!f.occ) vac++; } return {n, vac}; };
const blockPop = b => { let p = 0; for (const f of g.facs) if (f.x >= b.x0 && f.x < b.x0 + BW && f.occ) p += f.persons.length; return p; };
const ensureShaft = (b, L) => {
  let sh = b.shaft, cap = MAXH;
  if (SKY) {
    if (L > SKY_L) {   // torre de cima: poço B nasce no saguão aéreo
      if (!b.shaftB) {
        const c = g.shaftCheck('elevator', b.x0 + SH2X, SKY_L, SKY_L + 4); if (!c.ok) { dbg('poço B:', c.err); return false; }
        if (!afford(c.cost + 50000, reserve())) return 'wait';
        const r = g.placeShaft('elevator', b.x0 + SH2X, SKY_L, SKY_L + 4); if (!r.ok) return false; b.shaftB = r.shaft; dbg('poço B no bloco', b.i);
      }
      sh = b.shaftB;
    } else cap = SKY_L;
  }
  while (sh.hi < L) {
    const n = Math.min(4, cap - sh.hi, L - sh.hi + 3); if (n <= 0) return false;
    const r = g.extendShaft(sh, 1, n, true);
    if (!r.ok) { dbg('poço não estende:', r.err); return false; }
    if (!afford(r.cost, reserve())) return 'wait';
    g.extendShaft(sh, 1, n);
  }
  return true;
};
const wantCars = b => Math.min(3, Math.max(1 + Math.floor(b.top / 8), 1 + Math.floor(blockPop(b) / 100)));
// expresso do térreo ao saguão aéreo: só quando a fileira do andar 14 (com o saguão) já existe
const skyExpress = (b) => {
  if (!SKY || b.exp || b.top < SKY_L + 1) return;
  const c = g.shaftCheck('express', b.x0 + EXPX, 0, SKY_L); if (!c.ok) { if (!/Dinheiro/.test(c.err || '')) { b.exp = 'x'; dbg('expresso:', c.err); } return; }
  if (!afford(c.cost + 100000, reserve())) return;
  const r = g.placeShaft('express', b.x0 + EXPX, 0, SKY_L); if (r.ok) { b.exp = r.shaft; dbg('expresso no bloco', b.i); }
};
const initBlock = (b) => {
  const need = (b.i ? kindCost('lobby', BW) : 0) + 130000 + 90000 + 40000;
  if (!afford(need, reserve())) return false;
  if (b.i && !place('lobby', 0, b.x0, {w: BW})) return false;
  const r = g.placeShaft('elevator', b.x0 + SHX, 0, Math.min(MAXH, 8)); if (!r.ok) { dbg('poço:', r.err); return false; }
  b.shaft = r.shaft; b.init = true; b.top = 0; b.row = null;
  // saguão e poço pagos: escada ao subsolo, piso do subsolo e a primeira bomba (a água não vem da rua)
  ensureBasement(b, -1);
  if (!g.stairs.some(s => s.L === -1 && s.x >= b.x0 && s.x < b.x0 + BW)) g.placeStairs('stairs', -1, b.x0);
  dbg('bloco', b.i, 'iniciado');
  return true;
};
// antes de abrir a fileira L do bloco: alguma fonte alcança os dois lados e a capacidade cobre? 'ok' | 'obra' (construindo/esperando) | 'travado'
const provide = (b, L) => {
  const rects = [0, 16, 32, 48].map(dx => ({L, x: b.x0 + dx, w: 8, h: 1}));
  for (const res of ['energia', 'agua']) {
    const miss = rects.filter(r => !covered(res, r));
    if (miss.length) {
      if (pendingInfra()) return 'obra';
      const targets = rects.concat(rects.map(r => ({...r, L: r.L + 1}))).map(r => ({r, w: 1}));
      let r = null;
      if (res === 'energia') { const s = bestSite(genKind(), targets); if (s) r = buildInfra(genKind(), s, `fileira ${L} sem alcance de energia`); }
      else {
        for (const k of pumpKinds()) { const s = bestSite(k, targets); if (s && s.raw >= targets.length * 0.99) { r = buildInfra(k, s, `fileira ${L} sem alcance de água`); break; } }
        if (r === null || r === false) {   // nenhuma bomba cobre: caixa (a água sobe por recalque), só vale se sobra dinheiro
          const t = rects.map(q => ({r: q, w: 1}));
          if (L > 2 && g.facs.some(f => f.k.startsWith('bomba') && f.build >= 1)) r = fixWaterChain(t);
        }
      }
      if (r === true || r === 'wait') return 'obra';
      return 'travado';
    }
  }
  if (!pendingInfra()) {
    // capacidade projetada para esta fileira (~30 de energia, ~20 de água) e margem do perfil
    for (const res of ['energia', 'agua']) {
      const rowUse = res === 'energia' ? 30 : 20;
      if ((projUse(res, rowUse)) * (res === 'energia' ? P.folgaE : P.folgaA) > flow(res)) {
        const r = fixCapacity(res); if (r === true || r === 'wait') return 'obra';
        // sem como ampliar: segue (o corte, se vier, é reativo)
      }
    }
  } else return 'obra';
  return 'ok';
};
const grow = (b) => {
  if (!b.init) return initBlock(b) ? 'ok' : 'espera';
  // continua a fileira em andamento
  for (let guard = 0; guard < 4; guard++) {
    if (!b.row) {
      const L = b.top + 1; if (L > MAXH) return 'cheio';
      const ts = tenantStats();
      if (ts.n > 6 && ts.vac / ts.n > P.vac) return 'vacância';
      const sh = ensureShaft(b, L); if (sh !== true) return 'espera';
      const pv = provide(b, L); if (pv !== 'ok') return pv === 'travado' ? 'travado' : 'espera';
      const slab = g.floorCheck(L, b.x0, b.x0 + BW - 1);
      if (!slab.ok && !g.slab.get(L, b.x0 + 4)) return slab.err && slab.err.startsWith('Dinheiro') ? 'espera' : 'espera';
      if (slab.ok) { if (!afford(slab.cost + 100000, reserve())) return 'espera'; g.placeFloorSpan(L, b.x0, b.x0 + BW - 1); }
      b.row = {L, todo: rowPlan(L, b).sort((a, c) => a[1] - c[1])};
    }
    const row = b.row;
    while (row.todo.length) {
      const [k, rx] = row.todo[0];
      if (!afford(kindCost(k), reserve())) return 'espera';
      row.todo.shift();
      if (!placeable(k, row.L, b.x0 + rx)) continue;
      place(k, row.L, b.x0 + rx);
    }
    b.top = row.L; b.row = null;
    lowStairs(b);
  }
  return 'ok';
};
// escadas nos 3 primeiros andares (vaga central): aliviam o elevador nas viagens curtas
const lowStairs = (b) => {
  b.st = b.st || {};
  for (const L of [0, 1, 2]) if (!b.st[L] && b.top >= L + 1) { const r = g.canPlaceStairs('stairs', L, b.x0 + CX); if (r.ok) { g.placeStairs('stairs', L, b.x0 + CX); b.st[L] = true; } else if (!(r.err || '').startsWith('Dinheiro')) b.st[L] = true; }
};
const cars = (b) => {
  if (!b.init) return;
  while (b.shaft.cars.length < wantCars(b) && afford(TRANSPORT.elevator.carCost, reserve()) && !g.addCar(b.shaft)) {}
  if (SKY) {
    skyExpress(b);
    if (b.shaftB) while (b.shaftB.cars.length < Math.min(3, 1 + Math.floor((b.top - SKY_L) / 5)) && afford(TRANSPORT.elevator.carCost, reserve()) && !g.addCar(b.shaftB)) {}
    if (b.exp && b.exp !== 'x') while (b.exp.cars.length < Math.min(3, 1 + Math.floor(blockPop(b) / 120)) && afford(TRANSPORT.express.carCost, reserve()) && !g.addCar(b.exp)) {}
    return;
  }
  // 2º poço quando o bloco enche (esperas longas derrubam a nota)
  if (b.type === 'hotel' && !b.shaft2 && b.top >= 3 && afford(150000, reserve())) {   // as camareiras só usam o elevador de serviço
    const r = g.placeShaft('service', b.x0 + SH2X, 0, b.shaft.hi); if (r.ok) { b.shaft2 = r.shaft; dbg('elevador de serviço no bloco', b.i); }
  }
  if (!b.shaft2 && b.top >= 8 && (blockPop(b) > 200 || g.avgEval < 108) && b.shaft.cars.length >= 2 && afford(180000, reserve())) {
    const r = g.placeShaft('elevator', b.x0 + SH2X, 0, b.shaft.hi); if (r.ok) { b.shaft2 = r.shaft; dbg('2º poço no bloco', b.i); }
  }
  if (b.shaft2) {
    const s2 = b.shaft2;
    if (s2.hi < b.shaft.hi) { const r = g.extendShaft(s2, 1, b.shaft.hi - s2.hi, true); if (r.ok && afford(r.cost, reserve())) g.extendShaft(s2, 1, b.shaft.hi - s2.hi); }
    while (s2.cars.length < Math.min(3, wantCars(b)) && afford(TRANSPORT.elevator.carCost, reserve()) && !g.addCar(s2)) {}
  }
};

// ------------------------------------------------------------------ extras por estrela (só com caixa folgado)
let groundX = {taxi: -8, busstop: -24};
const extras = () => {
  const rich = g.funds > 2.5 * reserve() + 300000;
  if (g.star >= 2 && g.pop > 120 && rich) {
    for (const k of ['taxi', 'busstop']) if (!g.facs.some(f => f.k === k) && g.pop > (k === 'taxi' ? 120 : 250) && afford(kindCost(k), reserve() + 150000)) { if (place(k, 0, groundX[k])) dbg('construiu', k); else groundX[k] -= 4; }
  }
  if (g.star >= 2 && g.pop > 150) {   // segurança não espera sobra de caixa: furtos e brigas derrubam o humor (e o aluguel)
    for (const b of blocks) if (b.init && !g.facs.some(f => f.k === 'security' && f.x >= b.x0 && f.x < b.x0 + BW) && afford(kindCost('security'), reserve() + 50000)) {
      const s = sitesFor('security').filter(q => q.b === b && q.L === -1 && placeable('security', -1, q.x))[0];
      if (s) { place('security', s.L, s.x); dbg('posto de segurança no bloco', b.i); }
    }
    // um posto por ~8-12 andares: nos andares técnicos já levantados (cada posto cobre SEC.floors andares para cima e para baixo)
    if (!SEC_ROWS) for (const b of blocks) for (const L of [8, 16, 24]) {
      if (!b.init || b.top < L || g.facs.some(f => f.k === 'security' && f.L === L && f.x >= b.x0 && f.x < b.x0 + BW) || !afford(kindCost('security'), reserve() + 100000)) continue;
      const s = sitesFor('security').filter(q => q.b === b && q.L === L && placeable('security', L, q.x)).sort((a, c) => Math.abs(a.x - b.x0 - 20) - Math.abs(c.x - b.x0 - 20))[0];
      if (s) { place('security', s.L, s.x); dbg('posto de segurança no andar', L, 'do bloco', b.i); }
    }
  }
  if (g.star >= 3 && g.pop > 600 && rich && !g.facs.some(f => f.k === 'clinic') && afford(kindCost('clinic'), reserve() + 300000)) {
    const b = blocks[0], s = b && sitesFor('clinic').filter(q => q.L === -1 && placeable('clinic', -1, q.x))[0];
    if (s) { place('clinic', s.L, s.x); dbg('clínica'); }
  }
  // bateria segura os apagões (a rede some): uma por bloco quando já há geradores e sobra dinheiro
  if (g.star >= 3 && g.pop > 500 && g.funds > 900000 && !pendingInfra()) {
    const have = g.facs.filter(f => f.k.startsWith('bateria')).length, want = Math.min(blocks.filter(b => b.init).length, 2);
    if (have < want && g.facs.some(f => f.k === 'gerador' || f.k === 'geradorGas')) {
      const t = g.facs.filter(f => !f.dead && fullUse(f, 0) > 0).map(f => ({r: f, w: fullUse(f, 0)}));
      const bk = batKind(), s = bestSite(bk, t); if (s) buildInfra(bk, s, 'bateria contra apagão');
    }
  }
};
// preço: unidade vaga há dias baixa para "Econômico" (mais procura); nota média ruim baixa o resto
const pricing = () => {
  for (const f of g.facs) {
    const d = FAC[f.k]; if (!d.tenant || f.build < 1 || f.dead) continue;
    if (f.occ) { f._vd = 0; continue; }
    f._vd = (f._vd || 0) + 1;
    if (f._vd >= 5 && f.price < 2 && !f.cutE && !f.cutA) f.price = 2;
  }
};

const decide = () => {
  util(); infraNeed = 0;
  if (!pendingInfra()) { if (!fixCuts('energia')) fixCuts('agua'); }
  if (!blocks.length) blocks.push({i: 0, x0: 0, init: false, top: 0, row: null});
  // abre o próximo bloco quando o anterior passou da altura que a rede da rua e as bombas alcançam sem ajuda, ou travou; torres baixas e largas pedem menos
  // geradores e elevadores que uma torre alta
  const last = blocks[blocks.length - 1], openCost = kindCost('lobby', BW) + 300000;
  // com caixa sobrando (depois do 3★) abre blocos em paralelo: o dinheiro parado não rende; o freio é a ocupação das unidades já prontas
  const rich = g.star >= 3 && g.funds > reserve() + 5 * openCost, unfinished = blocks.filter(b => b.init && b.top < P.openAt).length;
  if (blocks.length < P.blocks && last.init && (last.top >= P.openAt || last.state === 'travado' || last.state === 'cheio' || (rich && unfinished < 2))) {
    if (afford(openCost, reserve() + 100000)) blocks.push({i: blocks.length, x0: blocks.length * BS, init: false, top: 0, row: null, type: blockType(blocks.length)});
    else if (!SAVE_OFF) infraNeed = Math.max(infraNeed, openCost);   // junta dinheiro para o próximo bloco em vez de gastar tudo em fileiras
  }
  for (const b of blocks.slice().sort((a, c) => a.top - c.top)) { b.state = grow(b); cars(b); }
  if (!pendingInfra() && g.funds > 150000) { if (!fixCapacity('energia')) fixCapacity('agua'); }
  extras();
};

// ------------------------------------------------------------------ partida
{ const r = g.placeFac('lobby', 0, 0, {w: BW}); if (!r.ok) throw new Error('saguão: ' + r.err); }
decide();
const milestones = {1: {day: 0, pop: 0, funds: g.funds}};
let lastStar = 1, redDays = 0, minFunds = g.funds, minDay = 0, lastHour = -1;
const cutHours = {energia: {reach: 0, cap: 0}, agua: {reach: 0, cap: 0}}, maxCut = {energia: 0, agua: 0}, roomHours = {n: 0};
let outageNow = {energia: false, agua: false}, outages = {energia: 0, agua: 0};
const rows = [];
const step = +process.env.SIM_STEP || 0.4, secPerDay = 1440 / MIN_PER_SEC, decideEvery = 60 / MIN_PER_SEC;
let wasRed = false, botMs = 0; let lastFin = null; let acc = 0, accDay = 0; const wall0 = Date.now(); let dayFundsMin = g.funds;
const MAXS = +process.env.SIM_MAX_SECONDS || 0;   // limite de tempo real: ao estourar, encerra e imprime o resumo do que já simulou
for (let d = 0; d < DAYS; d++) {
  if (MAXS && (Date.now() - wall0) / 1000 > MAXS) { process.stderr.write(`\n[limite de ${MAXS}s: parou no dia ${d}]`); break; }
  let dayCut = {energia: 0, agua: 0};
  for (let t = 0; t < secPerDay; t += step) {
    g.step(step); acc += step;
    if (g.funds < 0) { redDays += step / secPerDay; if (DEBUG && !wasRed) dbg('CAIXA NEGATIVO', Math.round(g.funds / 1000) + 'k; despesas do trimestre em curso:', JSON.stringify(g.fin.cur.mnt)); wasRed = true; } else wasRed = false;
    if (g.funds < minFunds) { minFunds = g.funds; minDay = g.day; }
    const hr = Math.floor(g.t / 60);
    if (hr !== lastHour) {   // amostra horária de cortes por causa
      lastHour = hr; const u = util(); let tenants = 0;
      for (const f of g.facs) if (f.build >= 1 && !f.dead && f.k !== 'ruin') { roomHours.n++; if (f.cutE) cutHours.energia[f.cutWhyE]++; if (f.cutA) cutHours.agua[f.cutWhyA]++; }
      maxCut.energia = Math.max(maxCut.energia, u.energia.cut); maxCut.agua = Math.max(maxCut.agua, u.agua.cut);
      dayCut.energia = Math.max(dayCut.energia, u.energia.cut); dayCut.agua = Math.max(dayCut.agua, u.agua.cut);
      for (const r of ['energia', 'agua']) { const on = g.outage[r] > g.t; if (on && !outageNow[r]) outages[r]++; outageNow[r] = on; }
    }
    if (acc >= decideEvery) { acc = 0; const t0 = Date.now(); decide(); botMs += Date.now() - t0; }
  }
  pricing();
  if (g.fin.last) { lastMaint = sumVals(g.fin.last.mnt); if (DEBUG && g.fin.last !== lastFin) { lastFin = g.fin.last; console.log('  trimestre: receita', JSON.stringify(g.fin.last.inc), 'manutenção', JSON.stringify(g.fin.last.mnt)); } }
  const u = util();
  if (g.star > lastStar) { for (let s = lastStar + 1; s <= g.star; s++) milestones[s] = {day: d + 1, pop: g.pop, funds: g.funds, rooms: g.facs.length}; lastStar = g.star; }
  const ts = tenantStats();
  rows.push({d: d + 1, season: SEASONS[g.season].name, star: g.star, pop: g.pop, funds: Math.round(g.funds / 1000), ev: Math.round(g.avgEval), top: Math.max(...blocks.map(b => b.top)), rooms: g.facs.length, vac: ts.n ? Math.round(100 * ts.vac / ts.n) : 0, cutE: dayCut.energia, cutA: dayCut.agua, e: Math.round(100 * u.energia.use / Math.max(1, u.energia.cap)), a: Math.round(100 * u.agua.use / Math.max(1, u.agua.cap)), st: blocks.map(b => b.state || '-').join('/')});
  process.stderr.write(`\rdia ${d + 1}/${DAYS} · ${g.star}★ · pop ${g.pop} · ${Math.round((Date.now() - wall0) / 1000)}s   `);
  if (g.star >= TARGET && d + 1 >= milestones[TARGET].day + 2) break;
}
process.stderr.write('\n');

// ------------------------------------------------------------------ relatório
console.log(`perfil ${PROFILE} · semente ${process.argv[4] || 1} · ${rows.length} dias · alvo ${TARGET}★`);
console.log('dia estação    ★   pop  caixa(k) nota  andar salas vaz% ⚡%  💧%  corte(E/Á)  blocos');
const every = rows.length > 45 ? 3 : rows.length > 24 ? 2 : 1;
rows.forEach((r, i) => { if (i % every === 0 || i === rows.length - 1) console.log(String(r.d).padStart(3), r.season.padEnd(9), r.star, String(r.pop).padStart(5), String(r.funds).padStart(9), String(r.ev).padStart(4), String(r.top).padStart(6), String(r.rooms).padStart(5), String(r.vac).padStart(4), String(r.e).padStart(4), String(r.a).padStart(4), `  ${r.cutE}/${r.cutA}`.padEnd(10), ' ', r.st); });
console.log('\n== resumo ==');
const ms = Object.entries(milestones).map(([s, m]) => `${s}★: ${m.day ? 'dia ' + m.day : '—'}${m.day ? ` (pop ${m.pop}, caixa ${Math.round(m.funds / 1000)}k)` : ''}`);
for (let s = lastStar + 1; s <= Math.max(TARGET, 3); s++) ms.push(`${s}★: não chegou`);
console.log('estrelas:', ms.join(' · '));
console.log(`caixa mínimo ${Math.round(minFunds / 1000)}k (dia ${minDay}) · dias no vermelho ${redDays.toFixed(2)} · caixa final ${Math.round(g.funds / 1000)}k`);
const pc = (n) => (100 * n / Math.max(1, roomHours.n)).toFixed(2) + '%';
console.log(`cortes (sala-horas / total): energia reach ${pc(cutHours.energia.reach)} cap ${pc(cutHours.energia.cap)} · água reach ${pc(cutHours.agua.reach)} cap ${pc(cutHours.agua.cap)} · máx. simultâneas E ${maxCut.energia} Á ${maxCut.agua}`);
console.log(`apagões ${outages.energia} · faltas d'água ${outages.agua} · eventos: ${JSON.stringify(events)}`);
const fin = rows[rows.length - 1];
console.log(`população ${g.pop} · nota média ${Math.round(g.avgEval)} · andares ${fin.top} · salas ${g.facs.length} · infra construída ${JSON.stringify(infraBuilt)}`);
// ocupação e motivos de vacância
const occ = {}; const why = {};
for (const f of g.facs) {
  const d = FAC[f.k]; if (!d.tenant || f.build < 1 || f.dead) continue;
  const o = occ[f.k] = occ[f.k] || {n: 0, o: 0}; o.n++; if (f.occ) { o.o++; continue; }
  let m = 'procurando (normal)';
  if (!g.reachable(f)) m = 'sem acesso';
  else if (f.cutE && f.cutA) m = 'sem energia e água';
  else if (f.cutE) m = 'sem energia (' + f.cutWhyE + ')';
  else if (f.cutA) m = 'sem água (' + f.cutWhyA + ')';
  else if (g.demandFactors(f).some(x => !x.met)) m = 'falta serviço exigido';
  else if (g.localMood(f) < 60) m = 'humor da vizinhança baixo';
  why[m] = (why[m] || 0) + 1;
}
const tn = Object.values(occ).reduce((a, o) => a + o.n, 0), to = Object.values(occ).reduce((a, o) => a + o.o, 0);
console.log(`ocupação ${to}/${tn} (${tn ? Math.round(100 * to / tn) : 0}%): ` + Object.entries(occ).map(([k, o]) => `${k} ${o.o}/${o.n}`).join(', '));
console.log('vagas por motivo:', JSON.stringify(why));
// por que há inquilinos descontentes: fatores negativos das unidades ocupadas com nota abaixo de 110
const neg = {}; let nUnhappy = 0, nOcc = 0;
for (const f of g.facs) if (FAC[f.k].tenant && f.occ && f.build >= 1) { nOcc++; const bd = g.evalBreakdown(f); if (bd.reduce((a, o) => a + o.v, 0) < 110) { nUnhappy++; for (const o of bd) if (o.v <= -3) { const k = o.key || o.label.slice(0, 22); neg[k] = (neg[k] || 0) + 1; } } }
console.log(`descontentes (<110): ${nUnhappy}/${nOcc} · fatores negativos:`, JSON.stringify(neg));
{ let n = 0, sc = 0, cam = 0, none = 0; const byL = {}; for (const f of g.facs) if (FAC[f.k].tenant && f.occ && f.build >= 1) { n++; const c = g.secCoverage(f); sc += c; if (!g.secPosts(f).length) { none++; byL[f.L] = (byL[f.L] || 0) + 1; } if (g.corrNear(f, 'cam')) cam++; }
  const days = Math.max(1, rows.length), ev = events['inquilinos saíram'] || 0, ft = events['furto'] || 0;
  console.log(`segurança: cobertura média ${(n ? sc / n : 0).toFixed(2)} · sem posto na área ${none}/${n} (andares ${JSON.stringify(byL)}) · com câmera ${cam}/${n} · postos ${g.facs.filter(f => f.k === 'security').length} · despejos (unidades) ${ev} = ${(ev / days).toFixed(2)}/dia · furtos ${ft} = ${(ft / days).toFixed(2)}/dia`); }
const types = {}; for (const f of g.facs) types[f.k] = (types[f.k] || 0) + 1;
console.log('salas:', Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + n).join(', '));
console.log(`tempo de execução: ${Math.round((Date.now() - wall0) / 1000)}s (decisões do bot: ${Math.round(botMs / 1000)}s)`);
