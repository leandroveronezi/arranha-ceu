'use strict';
// Gera catalogo-dados.js a partir do código do jogo: grupos, quantidade de modelos de cada sala e estados a mostrar.
//   npm run catalogo          regrava o arquivo
//   npm run catalogo -- --check   só confere se está em dia (usado por tests/catalogo.test.js)
// O catálogo (catalogo.html) lê esse arquivo; custos, estrelas, tags e descrições ele continua lendo ao vivo de js/data.js.
// Só aqui ficam as decisões humanas: o agrupamento por assunto (GRUPOS) e os estados especiais (ESTADOS).
// Item novo que não se encaixar em nenhum grupo faz o gerador falhar, pedindo para classificar.
const fs = require('fs'), vm = require('vm'), path = require('path');
const raiz = path.join(__dirname, '..'), saida = path.join(raiz, 'catalogo-dados.js');

// ---- decisões humanas
// Regras automáticas: o que casar entra no grupo sozinho, ordenado por estrela e custo.
const AUTO = {
  'Estrutura': d => d.corr && !d.veh,
  'Energia e água': d => d.util,
  'Túneis de veículos': d => d.corr && d.veh,
};
const GRUPOS = [
  ['Estrutura', ['lobby', 'corridor', 'corridorExt', 'corridorCam', 'corridorHyd', 'corridorSpr']],
  ['Elevadores e escadas', ['elevator', 'service', 'express', 'stairs', 'escalator']],
  ['Escritórios', ['office', 'coworking', 'officeEx']],
  ['Moradia', ['kitnet', 'condo', 'penthouse']],
  ['Hotel', ['single', 'twin', 'suite', 'housekeeping']],
  ['Comida', ['cafe', 'fastfood', 'bar', 'restaurant']],
  ['Comércio', ['mercado', 'shop', 'banco']],
  ['Lazer e cultura', ['jardim', 'academia', 'party', 'cinema', 'piscina', 'auditorio', 'landmark']],
  ['Serviços', ['security', 'lavanderia', 'creche', 'clinic']],
  ['Lixo e reciclagem', ['lixo', 'recycling']],
  ['Energia e água', ['gerador', 'geradorGas', 'solar', 'bateriaPequena', 'bateria', 'bateriaGrande', 'bomba', 'bombaMedia', 'bombaRecalque', 'bombaForte', 'caixa', 'caixaMedia', 'caixaGrande', 'caixaTorre', 'tratamento']],
  ['Transporte e garagem', ['busstop', 'taxi', 'transit', 'heliport', 'bike', 'parkspace', 'parkramp', 'carlift']],
  ['Túneis de veículos', ['tunnel', 'tunnelCam', 'tunnelExt', 'tunnelHyd', 'tunnelSpr', 'tunnelPortal', 'tunnelPortal2']],
  ['Pessoas', ['@pessoas']],
  ['Sons', ['@sons']],
];
const ths = () => [1, 2, 3, 4].map(t => ({label: (t + 1) + '★', po: {theme: t}}));
const ESTADOS = {
  tunnelPortal: [{label: 'saída à direita'}, {label: 'saída à esquerda', fo: {dir: -1}}],
  tunnelPortal2: [{label: 'saída à direita'}, {label: 'saída à esquerda', fo: {dir: -1}}],
  parkspace: [{label: 'vazia'}, {label: 'ocupada', fo: {owner: {}, id: 3, carCol: 0}}, {label: 'ocupada', fo: {owner: {}, id: 10, carCol: 3}}, {label: 'chegando', fo: {owner: {}, id: 17, carCol: 1, carT: 0}, po: {st: 'loop'}}, {label: 'saindo', fo: {id: 20, carCol: 4, leaveT: 0}, po: {st: 'loop'}}],
  bike: [{label: 'vazio', po: {fill: 0}}, {label: '40%', po: {fill: .4}}, {label: 'cheio', po: {fill: 1}}],
  lixo: [{label: '10%', fo: {lixo: 40}}, {label: '50%', fo: {lixo: 200}}, {label: '90%', fo: {lixo: 360}}, {label: 'cheio', fo: {lixo: 400}}, {label: 'caminhão', fo: {lixo: 300, truckEta: 1}, po: {truckP: 'loop'}}],
  cinema: [{label: 'parado', po: {lit: 0}}, {label: 'passando filme', po: {lit: 9}}],
  party: [{label: 'vazio', po: {lit: 0}}, {label: 'com gente', po: {lit: 12}}],
  auditorio: [{label: 'vazio', po: {lit: 0}}, {label: 'lotado', po: {lit: 30}}],
  single: [{label: 'vago', fo: {guests: []}}, {label: 'sujo', fo: {guests: [], dirty: true}}, {label: 'baratas', fo: {guests: [], bugs: 3}}, {label: 'dormindo', fo: {_dark: true}, po: {night: true}}],
  twin: [{label: 'vago', fo: {guests: []}}, {label: 'sujo', fo: {guests: [], dirty: true}}, {label: 'baratas', fo: {guests: [], bugs: 3}}, {label: 'dormindo', fo: {_dark: true}, po: {night: true}}],
  suite: [{label: 'vaga', fo: {guests: []}}, {label: 'suja', fo: {guests: [], dirty: true}}, {label: 'baratas', fo: {guests: [], bugs: 3}}, {label: 'dormindo', fo: {_dark: true}, po: {night: true}}],
  office: [{label: 'vago', po: {vacant: true}, fo: {occ: false}}], kitnet: [{label: 'à venda', po: {vacant: true}, fo: {occ: false}}], condo: [{label: 'à venda', po: {vacant: true}, fo: {occ: false}}], penthouse: [{label: 'à venda', po: {vacant: true}, fo: {occ: false}}],
  officeEx: [{label: 'vago', po: {vacant: true}, fo: {occ: false}}], coworking: [{label: 'vago', po: {vacant: true}, fo: {occ: false}}], shop: [{label: 'vaga', po: {vacant: true}, fo: {occ: false}}],
};

// ---- lê o jogo (mesmo contexto dos testes de arte: canvas falso, só para os painters rodarem)
const c = new Proxy({}, {get: (t, k) => (k in t ? t[k] : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({addColorStop() {}}) : k === 'measureText' ? () => ({width: 5}) : () => {}), set: (t, k, v) => (t[k] = v, true)});
const ctx = vm.createContext({console, Math, Date, performance: {now: () => 0}, window: {}, document: {}, localStorage: {}, location: {search: ''}});
vm.runInContext(['data', 'game', 'art', 'art-salas'].map(f => fs.readFileSync(path.join(raiz, 'js', f + '.js'), 'utf8')).join('\n;') + ';globalThis.__C = {FAC, TRANSPORT, vr, VARIANTS, paintFacility, U, FH}', ctx);
const {FAC, TRANSPORT, vr, VARIANTS, paintFacility, U, FH} = ctx.__C;
const todos = [...Object.keys(FAC), ...Object.keys(TRANSPORT)].filter(k => k !== 'ruin' && !(FAC[k] && FAC[k].nobuild));
const dado = k => FAC[k] || TRANSPORT[k];

// ---- quantos modelos visuais a sala tem: o painter anuncia em vr.n o maior n que pediu
function modelos(k) {
  const d = FAC[k]; vr.n = 0;
  const f = {id: 7, k, L: 1, x: 0, w: d.w, h: d.h, build: 1, guests: [{}], persons: [], fire: 0, price: 1, sty: 12345, dir: 1, occ: true, lixo: 220, line: 1, truckEta: 0};
  const o = {open: true, lit: 3, time: 0, lvl: .5, sun: 1, fill: .5, lod: true};
  try { paintFacility(c, f, 0, 0, d.w * U, d.h * FH, o); } catch (e) {}
  try { if (VARIANTS[k]) VARIANTS[k](c, f, 0, 0, d.w * U, d.h * FH, o); } catch (e) {}
  return vr.n > 1 ? vr.n : 0;
}

// ---- estados: os especiais vêm de ESTADOS; reservatórios e corredores são deduzidos dos dados
function estados(k) {
  const d = FAC[k];
  if (ESTADOS[k]) return ESTADOS[k];
  if (d.util && d.util.store) { const bat = d.util.store.res === 'energia'; return [{label: 'vazia', po: {lvl: 0}}, {label: '50%', po: {lvl: .5}}, {label: bat ? 'carregada' : 'cheia', po: {lvl: 1}}]; }
  if (d.corr && !d.veh) return ths();
  return [];
}

function gerar() {
  const grupos = GRUPOS.map(([nome, ks]) => [nome, ks.slice()]), vistos = new Set(grupos.flatMap(g => g[1]));
  const ord = (a, b) => (dado(a).star || 1) - (dado(b).star || 1) || (dado(a).cost || 0) - (dado(b).cost || 0);
  for (const g of grupos) if (AUTO[g[0]]) for (const k of todos.filter(k => FAC[k] && !vistos.has(k) && AUTO[g[0]](FAC[k])).sort(ord)) { g[1].push(k); vistos.add(k); }
  const sobra = todos.filter(k => !vistos.has(k));
  const lixo = [...vistos].filter(k => !k.startsWith('@') && !dado(k));
  const out = {grupos, modelos: {}, estados: {}};
  for (const k of todos) if (FAC[k]) { const m = modelos(k), e = estados(k); if (m) out.modelos[k] = m; if (e.length) out.estados[k] = e; }
  return {out, sobra, lixo};
}

const {out, sobra, lixo} = gerar();
if (sobra.length || lixo.length) {
  if (sobra.length) console.error('Sem grupo (classifique em GRUPOS ou AUTO, em tools/gerar-catalogo.js): ' + sobra.join(', '));
  if (lixo.length) console.error('Listados em GRUPOS mas inexistentes: ' + lixo.join(', '));
  process.exit(1);
}
const J = JSON.stringify;
const texto = '// GERADO por `npm run catalogo` (tools/gerar-catalogo.js). Não edite à mão: rode o comando de novo.\nconst CATALOGO = {\n' +
  ' grupos: [\n' + out.grupos.map(g => '  ' + J(g)).join(',\n') + '\n ],\n' +
  ' modelos: ' + J(out.modelos) + ',\n' +
  ' estados: {\n' + Object.entries(out.estados).map(([k, v]) => '  ' + k + ': ' + J(v)).join(',\n') + '\n }\n};\n';
if (process.argv.includes('--check')) {
  const atual = fs.existsSync(saida) ? fs.readFileSync(saida, 'utf8') : '';
  if (atual !== texto) { console.error('catalogo-dados.js está desatualizado: rode `npm run catalogo`.'); process.exit(2); }
  console.log('catalogo-dados.js em dia');
} else { fs.writeFileSync(saida, texto); console.log('catalogo-dados.js gerado: ' + out.grupos.length + ' grupos, ' + todos.length + ' itens'); }
