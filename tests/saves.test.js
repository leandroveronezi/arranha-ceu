'use strict';
// Saves por slot: lista, salvar, carregar, renomear, apagar, autosave, migração do save antigo e validação.
const {Game, SaveStore, upgradeSave, SAVE_SLOTS, SAVE_KEYS, K, ok, done, mk, put} = require('./helpers');
const SAVE_VERSION = K.SAVE_VERSION;

// armazenamento falso, com limite opcional de espaço para simular o navegador cheio
const fake = (limit = Infinity) => {
  const m = new Map();
  return {m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { const used = [...m].reduce((a, [kk, vv]) => a + (kk === k ? 0 : vv.length), 0); if (used + v.length > limit) throw new Error('QuotaExceededError'); m.set(k, v); }, removeItem: k => m.delete(k)};
};
const tower = () => { const g = mk(); put(g, 'office', 1, 0); g.star = 3; g.funds = 123456; g.t = 2 * 1440 + 30; return g; };

// lista e salvar
{
  const st = new SaveStore(fake()), g = tower();
  ok(st.list().length === SAVE_SLOTS && st.list().every(s => s.empty && !s.last), `${SAVE_SLOTS} slots, todos vazios no começo`);
  const r = st.save(2, g.serialize(), '  Minha torre  ', 1700000000000);
  ok(r.ok && r.meta.name === 'Minha torre' && r.meta.star === 3 && r.meta.day === 3 && r.meta.funds === 123456, 'salvar guarda nome e resumo (estrelas, dia, dinheiro)');
  const l = st.list();
  ok(!l[1].empty && l[1].last && l[0].empty && l[2].empty, 'só o slot 2 fica cheio e é o último usado');
  ok(st.last === 2, 'último slot usado');
  ok(st.save(1, g.serialize()).meta.name === 'Torre 1', 'nome padrão "Torre N"');
  ok(!st.save(0, g.serialize()).ok && !st.save(SAVE_SLOTS + 1, g.serialize()).ok, 'slot fora da faixa é recusado');
  st.save(2, g.serialize());
  ok(st.list()[1].name === 'Minha torre', 'sobrescrever mantém o nome');
  ok(st.save(3, g.serialize(), 'x'.repeat(60)).meta.name.length === 24, 'nome limitado a 24 letras');
}

// carregar de volta no jogo
{
  const st = new SaveStore(fake()), g = tower(); put(g, 'office', 1, 8); g.funds = 123456;
  st.save(1, g.serialize(), 'A');
  const d = st.load(1), g2 = new Game(); g2.msg = () => {}; g2.load(d);
  ok(g2.facs.filter(f => f.k === 'office').length === 2 && g2.funds === 123456 && g2.star === 3, 'carregar devolve a torre salva');
  ok(st.load(4) === null, 'slot vazio carrega null');
}

// renomear e apagar
{
  const st = new SaveStore(fake()), g = tower();
  st.save(1, g.serialize(), 'A'); st.save(2, g.serialize(), 'B');
  ok(st.rename(1, ' Nova ') && st.list()[0].name === 'Nova', 'renomear');
  ok(!st.rename(3, 'x') && !st.rename(1, '   '), 'renomear slot vazio ou nome em branco é recusado');
  st.remove(2);
  ok(st.list()[1].empty && st.last === null && st.load(2) === null && st.list()[0].name === 'Nova', 'apagar esvazia só aquele slot e limpa o "último usado"');
}

// autosave separado dos slots
{
  const raw = fake(), st = new SaveStore(raw), g = tower();
  ok(st.loadAutosave() === null, 'sem autosave no começo');
  st.autosave(g.serialize());
  ok(raw.m.has(SAVE_KEYS.auto) && SAVE_KEYS.auto === 'arranha-ceu-v1', 'o autosave continua na chave antiga');
  ok(st.loadAutosave().funds === 123456 && st.list().every(s => s.empty), 'autosave não ocupa slot');
  st.clearAutosave(); ok(st.loadAutosave() === null, 'novo jogo limpa o autosave');
}

// migração do save que já existia
{
  const raw = fake(), st = new SaveStore(raw), g = tower();
  raw.m.set(SAVE_KEYS.auto, JSON.stringify(g.serialize()));
  ok(st.migrateLegacy(1700000000000) === true && st.list()[0].name === 'Torre salva' && st.load(1).funds === 123456, 'o save antigo vira o slot 1, sem perda');
  ok(raw.m.has(SAVE_KEYS.auto), 'o autosave antigo continua lá');
  ok(st.migrateLegacy() === false, 'a migração só roda uma vez');
  st.remove(1); ok(st.migrateLegacy() === false && st.list()[0].empty, 'depois de apagar o slot 1, ele não volta sozinho');
  const vazio = new SaveStore(fake()); ok(vazio.migrateLegacy() === false, 'sem save antigo, nada a migrar');
}

// falha ao gravar o índice: o slot volta ao que era
{
  const raw = fake(), st = new SaveStore(raw), g = tower();
  st.save(1, g.serialize(), 'A'); const antes = raw.m.get(SAVE_KEYS.slot(1));
  const set = raw.setItem; raw.setItem = (k, v) => { if (k === SAVE_KEYS.index) throw new Error('falha'); set(k, v); };
  const g2 = tower(); g2.funds = 999;
  const r = st.save(1, g2.serialize(), 'B');
  ok(!r.ok && raw.m.get(SAVE_KEYS.slot(1)) === antes, 'se o índice não grava, o slot antigo não é perdido');
}

// navegador cheio / dados corrompidos
{
  const g = tower(), size = JSON.stringify(g.serialize()).length;
  const st = new SaveStore(fake(size * 1.5));
  ok(st.save(1, g.serialize(), 'A').ok, 'cabe um save');
  const r = st.save(2, g.serialize(), 'B');
  ok(!r.ok && /espaço/i.test(r.err) && st.list()[1].empty, 'sem espaço: avisa e não deixa slot pela metade');
}
{
  const raw = fake(), st = new SaveStore(raw);
  raw.m.set(SAVE_KEYS.index, '{não é json'); raw.m.set(SAVE_KEYS.slot(1), '{quebrado'); raw.m.set(SAVE_KEYS.auto, 'lixo');
  ok(st.list().every(s => s.empty) && st.load(1) === null && st.loadAutosave() === null, 'dados corrompidos viram slot vazio, sem exceção');
  ok(st.save(1, tower().serialize(), 'ok').ok && st.load(1).funds === 123456, 'e dá para salvar por cima');
  raw.m.set(SAVE_KEYS.slot(2), JSON.stringify({oi: 1})); const idx = JSON.parse(raw.m.get(SAVE_KEYS.index)); idx.slots[2] = {name: 'X', savedAt: 1, star: 1, funds: 0, day: 1, pop: 0}; raw.m.set(SAVE_KEYS.index, JSON.stringify(idx));
  ok(st.load(2) === null, 'um JSON que não é torre não carrega');
}

// validação de arquivos importados e formatos antigos
{
  ok(throws(() => upgradeSave(null)) && throws(() => upgradeSave({})) && throws(() => upgradeSave({facs: [], slab: []})), 'upgradeSave recusa o que não é save');
  const g = tower(), d = JSON.parse(JSON.stringify(g.serialize()));
  // um save de verdade do formato antigo: laje como lista com um item por andar (índice 0 = andar -10), versão 3
  const old = JSON.parse(JSON.stringify(d)); old.v = 3; old.slab = Array.from({length: 114}, () => []); for (const [L, runs] of d.slab) old.slab[L + 10] = runs; delete old.minL;
  const u = upgradeSave(JSON.parse(JSON.stringify(old)));
  ok(u.v === SAVE_VERSION && Array.isArray(u.slab[0]) && typeof u.slab[0][0] === 'number', 'um save v3 (laje por índice de andar) é migrado para o formato novo (laje por andar)');
  const gOld = new Game(); gOld.msg = () => {}; gOld.load(u); const gNew = new Game(); gNew.msg = () => {}; gNew.load(JSON.parse(JSON.stringify(d)));
  const cells = x => { const out = []; for (const L of x.slab.levels()) for (const [a, b] of x.slab.runs(L, -500, 500)) out.push(L + ':' + a + '-' + b); return out.sort().join(','); };
  ok(cells(gOld) === cells(gNew) && gOld.facs.length === gNew.facs.length, 'a laje migrada é exatamente a mesma do save novo');
  const direct = new Game(); direct.msg = () => {}; direct.load(JSON.parse(JSON.stringify(old)));
  ok(cells(direct) === cells(gNew), 'e o jogo também carrega o formato antigo direto, sem passar pela migração');
  const bare = JSON.parse(JSON.stringify(old)); delete bare.v; delete bare.shafts; delete bare.stairs;
  const u2 = upgradeSave(bare); ok(u2.v === SAVE_VERSION && Array.isArray(u2.shafts) && Array.isArray(u2.stairs), 'formato bem antigo (sem versão, sem poços e escadas) ganha o que falta e sobe para a versão atual');
  const g2 = new Game(); g2.msg = () => {}; g2.load(u2); ok(g2.facs.some(f => f.k === 'office'), 'e o jogo carrega');
  const cur = JSON.parse(JSON.stringify(g.serialize())); ok(upgradeSave(cur).v === SAVE_VERSION, 'o formato atual passa direto');
  const fut = JSON.parse(JSON.stringify(g.serialize())); fut.v = 99; ok(throws(() => upgradeSave(fut)), 'save de versão mais nova que o jogo é recusado, não carregado pela metade');
  const st = new SaveStore(fake()); st.save(1, g.serialize(), 'A'); const raw = JSON.parse(st.st.getItem(SAVE_KEYS.slot(1))); raw.v = 99; st.st.setItem(SAVE_KEYS.slot(1), JSON.stringify(raw));
  ok(st.load(1) === null, 'o slot com save de versão mais nova aparece como não carregável');
}
function throws(fn) { try { fn(); return false; } catch (_) { return true; } }
done('saves');
